import { logTenantActivity } from "@/lib/activity/log-tenant-activity";
import {
  createProposalPortalLink,
  deliverClientProposalLink,
  getTenantOwnerInviteTarget,
} from "@/lib/admin/client-invite-link";
import { getOfferWithItems } from "@/lib/offers/queries";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

export type SendProposalResult =
  | {
      ok: true;
      deliveryMethod: "email" | "link";
      portalLink: string | null;
      email: string;
      message: string;
    }
  | { ok: false; error: string };

export async function sendProposalToClient(args: {
  tenantId: string;
  offerId: string;
  actorUserId: string | null;
}): Promise<SendProposalResult> {
  const supabase = createServiceClient();
  const offer = await getOfferWithItems(args.offerId);

  if (!offer || offer.tenant_id !== args.tenantId) {
    return { ok: false, error: "Offer not found." };
  }

  if (offer.status !== "published") {
    return {
      ok: false,
      error: "Publish the offer before sending it to the client.",
    };
  }

  const owner = await getTenantOwnerInviteTarget(supabase, args.tenantId, {
    checkSignIn: supabase,
  });

  if (!owner) {
    return {
      ok: false,
      error: "Could not find the client owner for this tenant.",
    };
  }

  const linkResult = await createProposalPortalLink(supabase, {
    email: owner.email,
    fullName: owner.fullName,
    tenantId: args.tenantId,
  });

  if ("error" in linkResult) {
    return { ok: false, error: linkResult.error };
  }

  const delivery = await deliverClientProposalLink({
    email: owner.email,
    fullName: owner.fullName,
    businessName: owner.businessName,
    offerTitle: offer.title,
    portalLink: linkResult.inviteLink,
    linkType: linkResult.linkType,
  });

  await supabase
    .from(TABLES.tenantProfiles)
    .update({
      internal_status: "awaiting_agreement",
      onboarding_status: "invited",
    })
    .eq("tenant_id", args.tenantId);

  await logTenantActivity({
    tenantId: args.tenantId,
    actorUserId: args.actorUserId,
    actorType: "admin",
    action: "offer.proposal_sent",
    entityType: "client_offer",
    entityId: args.offerId,
    summary: `Sent proposal "${offer.title}" to ${owner.email}`,
    metadata: {
      offer_id: args.offerId,
      email: owner.email,
      link_type: linkResult.linkType,
      delivery_method: delivery.deliveryMethod,
    },
  });

  const message =
    delivery.deliveryMethod === "email"
      ? linkResult.linkType === "login"
        ? `Proposal email sent to ${owner.email}. They can sign in with their existing password.`
        : `Proposal email sent to ${owner.email}.`
      : delivery.emailError
        ? `${delivery.emailError} Copy the link below and send it to ${owner.email}.`
        : linkResult.linkType === "login"
          ? `Share the login link below with ${owner.email}. They already have a portal account.`
          : `Copy the proposal link below and send it to ${owner.email}.`;

  return {
    ok: true,
    deliveryMethod: delivery.deliveryMethod,
    portalLink:
      delivery.deliveryMethod === "link" ? linkResult.inviteLink : null,
    email: owner.email,
    message,
  };
}
