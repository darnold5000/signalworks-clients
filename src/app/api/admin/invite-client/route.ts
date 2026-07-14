import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { getPlan, PLAN_KEYS } from "@/lib/plans";
import { siteConfig } from "@/lib/site";
import {
  createServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { SW_TABLES } from "@/lib/supabase/tables";

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
  const admin = await getCurrentProfile();
  if (!admin || admin.role !== "admin") {
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
      .from(SW_TABLES.clients)
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${i + 2}`;
  }

  const { data: client, error: clientError } = await supabase
    .from(SW_TABLES.clients)
    .insert({
      slug,
      business_name: businessName,
      status: "onboarding",
      website_status: "building",
      website_url: websiteUrl || null,
      domain: domain || null,
      plan_name: plan.name,
      monthly_price_cents: plan.monthlyPriceCents,
      stripe_price_id: process.env[plan.envVar] || null,
      subscription_status: "none",
      support_email: siteConfig.supportEmail,
      contract_start_on: new Date().toISOString().slice(0, 10),
    })
    .select("*")
    .single();

  if (clientError || !client) {
    return NextResponse.json(
      { error: clientError?.message ?? "Could not create client" },
      { status: 400 },
    );
  }

  const redirectTo = `${siteConfig.url}/login`;
  const displayName = fullName || businessName;

  // Prefer invite email — client sets their own password. We never store/see it.
  const { data: invited, error: inviteError } =
    await supabase.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: displayName,
        role: "client",
        client_id: client.id,
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
            role: "client",
            client_id: client.id,
          },
          redirectTo,
        },
      });

    if (linkError || !linkData?.user) {
      await supabase.from(SW_TABLES.clients).delete().eq("id", client.id);
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

  await supabase.from(SW_TABLES.profiles).upsert(
    {
      id: userId,
      email,
      full_name: displayName,
      role: "client",
      active: true,
    },
    { onConflict: "id" },
  );

  const { error: memberError } = await supabase
    .from(SW_TABLES.clientMembers)
    .insert({
      client_id: client.id,
      profile_id: userId,
    });

  if (memberError) {
    return NextResponse.json(
      {
        error: memberError.message,
        clientId: client.id,
        note: "Client created but membership failed — link manually in sw_client_members.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    clientId: client.id,
    email,
    plan: plan.name,
    inviteMethod,
    inviteLink,
    message:
      inviteMethod === "email"
        ? `Invite email sent to ${email}. They set their own password — you never see it.`
        : `Client created. Copy the invite link and send it to ${email} (Supabase email invite was unavailable).`,
  });
}
