import { buildInviteOfferItemRows,
  dollarsToCents,
} from "@/lib/catalog/build-invite-offer";
import type { InviteClientRequest } from "@/lib/catalog/invite-validation";
import {
  getPaidAddOnsByKeys,
  getPlanTemplateByKey,
  getProductsByKeys,
} from "@/lib/catalog/queries";
import {
  createClientPortalAccessLink,
  deliverClientInviteLink,
} from "@/lib/admin/client-invite-link";
import {
  ensureOfferSowDocument,
  ensurePlatformTermsDocument,
} from "@/lib/offers/queries";

/**
 * Offer-first Invite Client orchestration.
 *
 * Commercial source of truth at invite time: client_offer_items on the created offer.
 * Compatibility projection: tenant_portal_settings.plan_name / monthly_price_cents.
 * Billing truth after Stripe activation: tenant_subscriptions (webhook-driven).
 * Immutable purchased snapshot after finalization: purchases + purchase_items.
 */
import { logTenantActivity } from "@/lib/activity/log-tenant-activity";
import type { ClientOffer, ClientOfferItem } from "@/lib/database/phase1-types";
import {
  isResendConfigured,
} from "@/lib/email/client-invite-email";
import { calculateOfferTotals } from "@/lib/offers/calculate-totals";
import { syncAllOfferItemsToStripe } from "@/lib/offers/stripe-catalog";
import { ROLE_SLUGS } from "@/lib/permissions";
import {
  ensureInviteActionLink,
  inviteRedirectUrl,
  portalUrlForInvites,
  siteConfig,
} from "@/lib/site";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

export type InviteClientResult =
  | {
      ok: true;
      tenantId: string;
      clientId: string;
      offerId: string;
      email: string;
      planName: string;
      inviteMethod: "email" | "link";
      inviteLink: string | null;
      message: string;
      redirectTo: string;
    }
  | { ok: false; error: string; tenantId?: string; note?: string };

type CreatedResources = {
  tenantId?: string;
  offerId?: string;
  authUserId?: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

async function findIdempotentInviteResult(
  idempotencyKey: string,
): Promise<InviteClientResult | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from(TABLES.tenantActivityLog)
    .select("tenant_id, metadata")
    .eq("action", "invite_client.completed")
    .contains("metadata", { idempotency_key: idempotencyKey })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.tenant_id) return null;

  const metadata = (data.metadata ?? {}) as Record<string, unknown>;
  const tenantId = data.tenant_id as string;

  return {
    ok: true,
    tenantId,
    clientId: tenantId,
    offerId: String(metadata.offer_id ?? ""),
    email: String(metadata.email ?? ""),
    planName: String(metadata.plan_name ?? ""),
    inviteMethod: metadata.invite_method === "email" ? "email" : "link",
    inviteLink:
      typeof metadata.invite_link === "string" ? metadata.invite_link : null,
    message: "Invite already processed for this submission.",
    redirectTo: `/admin/clients/${tenantId}/overview`,
  };
}

async function rollbackInviteResources(
  supabase: ReturnType<typeof createServiceClient>,
  created: CreatedResources,
) {
  if (created.authUserId) {
    try {
      await supabase.auth.admin.deleteUser(created.authUserId);
    } catch (error) {
      console.error("rollbackInviteResources.deleteUser", error);
    }
  }

  if (created.tenantId) {
    await supabase.from(TABLES.tenants).delete().eq("id", created.tenantId);
  }
}

export async function inviteClientWithOffer(
  input: InviteClientRequest,
  actorUserId: string | null,
): Promise<InviteClientResult> {
  if (input.idempotencyKey) {
    const existing = await findIdempotentInviteResult(input.idempotencyKey);
    if (existing) return existing;
  }

  const planTemplate = await getPlanTemplateByKey(input.planKey);
  if (!planTemplate) {
    return { ok: false, error: "Selected plan is not available." };
  }

  const products = await getProductsByKeys(input.productKeys);
  if (products.length !== input.productKeys.length) {
    return { ok: false, error: "One or more selected products are invalid." };
  }

  const paidAddOnKeys = input.paidAddOns.map((addOn) => addOn.productKey);
  const paidAddOnCatalog = await getPaidAddOnsByKeys(paidAddOnKeys);
  if (paidAddOnCatalog.length !== paidAddOnKeys.length) {
    return {
      ok: false,
      error: "One or more selected paid add-ons are invalid.",
    };
  }

  const paidAddOns = input.paidAddOns.map((selection) => {
    const catalogItem = paidAddOnCatalog.find(
      (item) => item.product_key === selection.productKey,
    )!;
    return {
      product_key: catalogItem.product_key,
      name: catalogItem.name,
      unit_amount_cents: dollarsToCents(selection.monthlyPriceDollars),
    };
  });

  const setupFeeCents = dollarsToCents(input.setupFeeDollars);
  const monthlyDiscountCents = dollarsToCents(input.monthlyDiscountDollars);
  const monthlyDiscountDurationMonths = input.monthlyDiscountDurationMonths ?? 0;
  const monthlyPriceCents = dollarsToCents(input.monthlyPriceDollars);
  const supabase = createServiceClient();
  const created: CreatedResources = {};

  try {
    const baseSlug = slugify(input.businessName) || "client";
    let slug = baseSlug;
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await supabase
        .from(TABLES.tenants)
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!existing) break;
      slug = `${baseSlug}-${i + 2}`;
    }

    const { data: tenant, error: tenantError } = await supabase
      .from(TABLES.tenants)
      .insert({
        slug,
        display_name: input.businessName,
        status: "onboarding",
        platform_category: "services",
      })
      .select("*")
      .single();

    if (tenantError || !tenant) {
      console.error("inviteClientWithOffer.tenant", tenantError?.message);
      return { ok: false, error: "Could not create client tenant." };
    }

    created.tenantId = tenant.id as string;
    const tenantId = created.tenantId;
    const displayName = input.contactName?.trim() || input.businessName;
    const websiteUrl = input.websiteUrl?.trim() || null;
    const domain = input.domain?.trim() || null;
    const phone = input.phone?.trim() || null;

    const { error: profileError } = await supabase.from(TABLES.tenantProfiles).insert({
      tenant_id: tenantId,
      display_name: input.businessName,
      legal_business_name: input.businessName,
      primary_contact_name: displayName,
      primary_contact_email: input.email,
      primary_contact_phone: phone,
      website_url: websiteUrl,
      primary_domain: domain,
      internal_status: "invited",
      onboarding_status: "invited",
    });

    if (profileError) {
      console.error("inviteClientWithOffer.profile", profileError.message);
      await rollbackInviteResources(supabase, created);
      return { ok: false, error: "Could not create client profile." };
    }

    if (displayName || phone || input.email) {
      await supabase.from(TABLES.tenantContacts).insert({
        tenant_id: tenantId,
        name: displayName,
        email: input.email,
        phone,
        contact_type: "owner",
        is_primary: true,
      });
    }

    // Compatibility projection — commercial truth lives on client_offer_items.
    const { error: settingsError } = await supabase
      .from(TABLES.tenantPortalSettings)
      .insert({
        tenant_id: tenantId,
        website_url: websiteUrl,
        domain,
        plan_name: planTemplate.name,
        monthly_price_cents: monthlyPriceCents,
        support_email: siteConfig.supportEmail,
        contract_start_on: new Date().toISOString().slice(0, 10),
      });

    if (settingsError) {
      console.error("inviteClientWithOffer.portalSettings", settingsError.message);
      await rollbackInviteResources(supabase, created);
      return { ok: false, error: "Could not create portal settings." };
    }

    const { error: subscriptionError } = await supabase
      .from(TABLES.tenantSubscriptions)
      .insert({
        tenant_id: tenantId,
        stripe_price_id: null,
        subscription_status: "none",
        standard_amount_cents: monthlyPriceCents,
        current_effective_amount_cents: monthlyPriceCents,
      });

    if (subscriptionError) {
      console.error("inviteClientWithOffer.subscription", subscriptionError.message);
      await rollbackInviteResources(supabase, created);
      return { ok: false, error: "Could not create subscription record." };
    }

    const offerTitle = `${input.businessName} — ${planTemplate.name}`;
    const termsDocument = await ensurePlatformTermsDocument(actorUserId);
    const { data: offer, error: offerError } = await supabase
      .from(TABLES.clientOffers)
      .insert({
        tenant_id: tenantId,
        title: offerTitle,
        description: null,
        currency: "usd",
        status: "published",
        requires_terms_acceptance: true,
        terms_document_id: termsDocument.id,
        published_at: new Date().toISOString(),
        created_by: actorUserId,
      })
      .select("*")
      .single();

    if (offerError || !offer) {
      console.error("inviteClientWithOffer.offer", offerError?.message);
      await rollbackInviteResources(supabase, created);
      return { ok: false, error: "Could not create client offer." };
    }

    created.offerId = offer.id as string;

    const itemRows = buildInviteOfferItemRows({
      tenantId,
      offerId: created.offerId,
      plan: {
        plan_key: planTemplate.plan_key,
        name: planTemplate.name,
        monthly_price_cents: monthlyPriceCents,
        billing_interval: planTemplate.billing_interval as
          | "month"
          | "day"
          | "week"
          | "year",
      },
      products: products.map((product) => ({
        product_key: product.product_key,
        name: product.name,
      })),
      extras: {
        setup_fee_cents: setupFeeCents > 0 ? setupFeeCents : undefined,
        monthly_discount_cents:
          monthlyDiscountCents > 0 ? monthlyDiscountCents : undefined,
        monthly_discount_duration_months:
          monthlyDiscountCents > 0 && monthlyDiscountDurationMonths > 0
            ? monthlyDiscountDurationMonths
            : undefined,
        paid_add_ons: paidAddOns.length > 0 ? paidAddOns : undefined,
      },
    });

    const { data: insertedItems, error: itemsError } = await supabase
      .from(TABLES.clientOfferItems)
      .insert(itemRows)
      .select("*");

    if (itemsError || !insertedItems) {
      console.error("inviteClientWithOffer.offerItems", itemsError?.message);
      await rollbackInviteResources(supabase, created);
      return { ok: false, error: "Could not create offer line items." };
    }

    const totals = calculateOfferTotals(insertedItems as ClientOfferItem[]);
    const fullOffer = { ...(offer as ClientOffer), ...totals };
    const sowDocument = await ensureOfferSowDocument({
      tenantId,
      client: {
        businessName: input.businessName,
        contactName: displayName,
        email: input.email,
        phone,
        website: websiteUrl,
        domain,
        planName: planTemplate.name,
        projectStart: new Date().toISOString().slice(0, 10),
      },
      offer: fullOffer,
      items: insertedItems as ClientOfferItem[],
      createdBy: actorUserId,
    });

    const { error: totalsError } = await supabase
      .from(TABLES.clientOffers)
      .update({
        ...totals,
        sow_document_id: sowDocument.id,
      })
      .eq("id", created.offerId);

    if (totalsError) {
      console.error("inviteClientWithOffer.offerTotals", totalsError.message);
      await rollbackInviteResources(supabase, created);
      return { ok: false, error: "Could not finalize offer totals." };
    }

    try {
      await syncAllOfferItemsToStripe(
        fullOffer,
        insertedItems as ClientOfferItem[],
      );
    } catch (error) {
      console.error("inviteClientWithOffer.stripe", error);
      await rollbackInviteResources(supabase, created);
      return {
        ok: false,
        error: "Could not prepare Stripe catalog records for this offer.",
      };
    }

    const redirectTo = inviteRedirectUrl(portalUrlForInvites());
    const linkResult = await createClientPortalAccessLink(supabase, {
      email: input.email,
      fullName: displayName,
      tenantId,
    });

    if ("error" in linkResult) {
      console.error(
        "inviteClientWithOffer.authInvite",
        linkResult.detail ?? linkResult.error,
      );
      await rollbackInviteResources(supabase, created);
      return {
        ok: false,
        error: linkResult.error,
      };
    }

    created.authUserId = linkResult.userId;
    const inviteLink = linkResult.inviteLink;

    let inviteMethod: "email" | "link" = "link";
    let inviteEmailError: string | null = null;

    if (isResendConfigured()) {
      const delivery = await deliverClientInviteLink({
        email: input.email,
        fullName: displayName,
        businessName: input.businessName,
        inviteLink,
      });
      inviteMethod = delivery.inviteMethod;
      inviteEmailError = delivery.inviteEmailError;
    }

    await supabase.from(TABLES.profiles).upsert(
      {
        id: created.authUserId,
        email: input.email,
        full_name: displayName,
        active: true,
      },
      { onConflict: "id" },
    );

    const { data: ownerRole, error: roleError } = await supabase
      .from(TABLES.roles)
      .select("id")
      .is("tenant_id", null)
      .eq("slug", ROLE_SLUGS.tenantOwner)
      .single();

    if (roleError || !ownerRole) {
      return {
        ok: false,
        error: "Tenant owner role is not configured.",
        tenantId,
        note: "Tenant and offer were created but membership failed — link manually in tenant_memberships.",
      };
    }

    const { error: memberError } = await supabase
      .from(TABLES.tenantMemberships)
      .insert({
        tenant_id: tenantId,
        user_id: created.authUserId,
        role_id: ownerRole.id,
        status: "active",
      });

    if (memberError) {
      console.error("inviteClientWithOffer.membership", memberError.message);
      return {
        ok: false,
        error: "Tenant created but membership failed.",
        tenantId,
        note: "Link the owner manually in tenant_memberships.",
      };
    }

    await logTenantActivity({
      tenantId,
      actorUserId,
      actorType: "admin",
      action: "invite_client.completed",
      entityType: "tenant",
      entityId: tenantId,
      summary: `Invited ${input.businessName} with ${planTemplate.name} offer`,
      metadata: {
        idempotency_key: input.idempotencyKey ?? null,
        offer_id: created.offerId,
        email: input.email,
        plan_name: planTemplate.name,
        plan_key: planTemplate.plan_key,
        invite_method: inviteMethod,
        invite_link: inviteMethod === "link" ? inviteLink : null,
      },
    });

    const message =
      inviteMethod === "email"
        ? `Invite email sent from ${siteConfig.name} to ${input.email}. They set their own password — you never see it.`
        : inviteEmailError
          ? `${inviteEmailError} Copy the invite link below and send it to ${input.email}.`
          : isResendConfigured()
            ? `Copy the invite link below and send it to ${input.email}.`
            : `Client created. Add RESEND_API_KEY to send branded invite email automatically, or copy the link below for ${input.email}.`;

    return {
      ok: true,
      tenantId,
      clientId: tenantId,
      offerId: created.offerId,
      email: input.email,
      planName: planTemplate.name,
      inviteMethod,
      inviteLink: inviteMethod === "link" ? inviteLink : null,
      message,
      redirectTo: `/admin/clients/${tenantId}/overview`,
    };
  } catch (error) {
    console.error("inviteClientWithOffer", error);
    await rollbackInviteResources(supabase, created);
    return { ok: false, error: "Could not complete client invite." };
  }
}
