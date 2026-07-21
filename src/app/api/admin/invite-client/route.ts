import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile, isPlatformAdmin } from "@/lib/auth";
import { getPlan, PLAN_KEYS } from "@/lib/plans";
import { ROLE_SLUGS } from "@/lib/permissions";
import {
  isResendConfigured,
  sendClientInviteEmail,
} from "@/lib/email/client-invite-email";
import {
  ensureInviteActionLink,
  inviteRedirectUrl,
  portalUrlForInvites,
  siteConfig,
} from "@/lib/site";
import { ensureTenantProfile } from "@/lib/tenant-profiles";
import {
  createServiceClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

function normalizeOptionalUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const optionalUrl = z
  .string()
  .transform((value) => normalizeOptionalUrl(value))
  .pipe(z.union([z.literal(""), z.string().url()]));

const bodySchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  planKey: z.enum(PLAN_KEYS),
  domain: z.string().trim().max(200).optional().or(z.literal("")),
  websiteUrl: optionalUrl.optional().or(z.literal("")),
  fullName: z.string().trim().max(120).optional().or(z.literal("")),
});

function validationErrorMessage(error: z.ZodError): string {
  const fieldErrors = error.flatten().fieldErrors;
  const parts = Object.entries(fieldErrors).flatMap(([field, messages]) => {
    if (!Array.isArray(messages)) return [];
    return messages.map((message) => `${field}: ${message}`);
  });
  return parts[0] ?? "Invalid request";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !(await isPlatformAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is required to invite clients." },
      { status: 503 },
    );
  }

  if (!isServiceRoleConfigured()) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY is missing. Add it to .env.local (Supabase → Project Settings → API → service_role secret).",
      },
      { status: 503 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: validationErrorMessage(parsed.error),
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { businessName, email, planKey, domain, websiteUrl, fullName } =
    parsed.data;
  const plan = getPlan(planKey);
  if (!plan) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const baseSlug = slugify(businessName) || "client";
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
      display_name: businessName,
      status: "onboarding",
      platform_category: "services",
    })
    .select("*")
    .single();

  if (tenantError || !tenant) {
    return NextResponse.json(
      { error: tenantError?.message ?? "Could not create tenant" },
      { status: 400 },
    );
  }

  const { error: settingsError } = await supabase
    .from(TABLES.tenantPortalSettings)
    .insert({
      tenant_id: tenant.id,
      website_url: websiteUrl || null,
      domain: domain || null,
      plan_name: plan.name,
      monthly_price_cents: plan.monthlyPriceCents,
      support_email: siteConfig.supportEmail,
      contract_start_on: new Date().toISOString().slice(0, 10),
    });

  if (settingsError) {
    await supabase.from(TABLES.tenants).delete().eq("id", tenant.id);
    return NextResponse.json(
      { error: settingsError.message },
      { status: 400 },
    );
  }

  const { error: subscriptionError } = await supabase
    .from(TABLES.tenantSubscriptions)
    .insert({
      tenant_id: tenant.id,
      stripe_price_id: process.env[plan.envVar] || null,
      subscription_status: "none",
    });

  if (subscriptionError) {
    await supabase.from(TABLES.tenants).delete().eq("id", tenant.id);
    return NextResponse.json(
      { error: subscriptionError.message },
      { status: 400 },
    );
  }

  await ensureTenantProfile({
    tenantId: tenant.id,
    displayName: businessName,
    primaryContactEmail: email,
    websiteUrl: websiteUrl || null,
    primaryDomain: domain || null,
    internalStatus: "invited",
    onboardingStatus: "invited",
  });

  const redirectTo = inviteRedirectUrl(portalUrlForInvites());
  const displayName = fullName || businessName;

  const { data: linkData, error: linkError } =
    await supabase.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        data: {
          full_name: displayName,
          tenant_id: tenant.id,
        },
        redirectTo,
      },
    });

  if (linkError || !linkData?.user) {
    await supabase.from(TABLES.tenants).delete().eq("id", tenant.id);
    return NextResponse.json(
      {
        error:
          linkError?.message ||
          "Could not create invite link. Check Supabase Auth settings.",
      },
      { status: 400 },
    );
  }

  const userId = linkData.user.id;
  const inviteLink = ensureInviteActionLink(
    linkData.properties?.action_link ?? "",
    redirectTo,
  );

  if (!inviteLink) {
    await supabase.from(TABLES.tenants).delete().eq("id", tenant.id);
    return NextResponse.json(
      { error: "Could not create invite link." },
      { status: 400 },
    );
  }

  let inviteMethod: "email" | "link" = "link";
  let inviteEmailError: string | null = null;

  if (isResendConfigured()) {
    const sent = await sendClientInviteEmail({
      email,
      fullName: displayName,
      businessName,
      inviteLink,
    });
    if (sent.ok) {
      inviteMethod = "email";
    } else {
      inviteEmailError = sent.error ?? "Could not send invite email.";
    }
  }

  await supabase.from(TABLES.profiles).upsert(
    {
      id: userId,
      email,
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
    return NextResponse.json(
      {
        error: roleError?.message ?? "Tenant owner role is not configured.",
        tenantId: tenant.id,
        note: "Tenant created but membership failed — link manually in tenant_memberships.",
      },
      { status: 400 },
    );
  }

  const { error: memberError } = await supabase
    .from(TABLES.tenantMemberships)
    .insert({
      tenant_id: tenant.id,
      user_id: userId,
      role_id: ownerRole.id,
      status: "active",
    });

  if (memberError) {
    return NextResponse.json(
      {
        error: memberError.message,
        tenantId: tenant.id,
        note: "Tenant created but membership failed — link manually in tenant_memberships.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    tenantId: tenant.id,
    clientId: tenant.id,
    email,
    plan: plan.name,
    inviteMethod,
    inviteLink: inviteMethod === "link" ? inviteLink : null,
    message:
      inviteMethod === "email"
        ? `Invite email sent from ${siteConfig.name} to ${email}. They set their own password — you never see it.`
        : inviteEmailError
          ? `${inviteEmailError} Copy the invite link below and send it to ${email}.`
          : isResendConfigured()
            ? `Copy the invite link below and send it to ${email}.`
            : `Client created. Add RESEND_API_KEY to send branded invite email automatically, or copy the link below for ${email}.`,
  });
}
