import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile, isPlatformAdmin } from "@/lib/auth";
import { getPlan, PLAN_KEYS } from "@/lib/plans";
import { ROLE_SLUGS } from "@/lib/permissions";
import { siteConfig } from "@/lib/site";
import {
  createServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

const bodySchema = z.object({
  businessName: z.string().min(2).max(120),
  email: z.string().email(),
  planKey: z.enum(PLAN_KEYS),
  domain: z.string().max(200).optional().or(z.literal("")),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  fullName: z.string().max(120).optional().or(z.literal("")),
});

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

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
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

  const redirectTo = `${siteConfig.url}/login`;
  const displayName = fullName || businessName;

  const { data: invited, error: inviteError } =
    await supabase.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: displayName,
        tenant_id: tenant.id,
      },
      redirectTo,
    });

  let userId = invited?.user?.id ?? null;
  let inviteLink: string | null = null;
  let inviteMethod: "email" | "link" = "email";

  if (inviteError || !userId) {
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
            inviteError?.message ||
            linkError?.message ||
            "Could not invite user. Check Supabase Auth email settings.",
        },
        { status: 400 },
      );
    }

    userId = linkData.user.id;
    inviteLink = linkData.properties?.action_link ?? null;
    inviteMethod = "link";
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
    inviteLink,
    message:
      inviteMethod === "email"
        ? `Invite email sent to ${email}. They set their own password — you never see it.`
        : `Tenant created. Copy the invite link and send it to ${email} (Supabase email invite was unavailable).`,
  });
}
