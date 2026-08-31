#!/usr/bin/env node
/**
 * Link an existing Supabase Auth user to a Signal Works client portal tenant.
 * Creates the tenant + minimal portal rows when missing (Ton Tavern bootstrap).
 *
 * Usage:
 *   CLIENT_EMAIL=owner@example.com npm run db:provision-portal-client
 *
 * Optional:
 *   CLIENT_USER_ID=<uuid>
 *   TENANT_SLUG=ton-tavern-fitness
 *   TENANT_DISPLAY_NAME="Ton Tavern Fitness"
 *   WEBSITE_URL=https://tontavern.hiresignalworks.com
 *   CONTACT_NAME="Melissa Nunley"
 */
import { loadEnvLocal } from "./load-env.mjs";

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const clientEmail = process.env.CLIENT_EMAIL?.trim().toLowerCase();
const clientUserId = process.env.CLIENT_USER_ID?.trim();
const tenantSlug = process.env.TENANT_SLUG?.trim() || "ton-tavern-fitness";
const tenantDisplayName =
  process.env.TENANT_DISPLAY_NAME?.trim() || "Ton Tavern Fitness";
const websiteUrl =
  process.env.WEBSITE_URL?.trim() || "https://tontavern.hiresignalworks.com";
const contactName = process.env.CONTACT_NAME?.trim() || null;
const tenantOwnerRoleId = "a289cb68-49ba-4397-8906-72e62dae7925";

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (!clientEmail && !clientUserId) {
  console.error("Set CLIENT_EMAIL or CLIENT_USER_ID.");
  process.exit(1);
}

async function rest(path, options = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  return { res, data };
}

async function findAuthUser() {
  if (clientUserId) {
    const res = await fetch(`${url}/auth/v1/admin/users/${clientUserId}`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });
    if (!res.ok) return null;
    return res.json();
  }

  let page = 1;
  while (page <= 10) {
    const res = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=200`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });
    if (!res.ok) throw new Error(`Auth lookup failed: ${res.status}`);
    const payload = await res.json();
    const users = payload.users ?? payload;
    const match = users.find((user) => user.email?.toLowerCase() === clientEmail);
    if (match) return match;
    if (!users.length || users.length < 200) break;
    page += 1;
  }
  return null;
}

async function ensureTenant() {
  const { data: existing } = await rest(
    `tenants?slug=eq.${encodeURIComponent(tenantSlug)}&select=id,slug,display_name`,
  );
  if (existing?.[0]?.id) return existing[0].id;

  const { res, data } = await rest("tenants", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      slug: tenantSlug,
      display_name: tenantDisplayName,
      status: "active",
      platform_category: "services",
    }),
  });
  if (!res.ok) {
    console.error("Tenant create failed:", data);
    process.exit(1);
  }

  const tenantId = data[0].id;
  console.log(`Created tenant ${tenantSlug} (${tenantId})`);

  const domain = websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const profileEmail = clientEmail ?? "";

  await rest("tenant_profiles", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      tenant_id: tenantId,
      display_name: tenantDisplayName,
      legal_business_name: tenantDisplayName,
      primary_contact_name: contactName || tenantDisplayName,
      primary_contact_email: profileEmail,
      website_url: websiteUrl,
      primary_domain: domain,
      internal_status: "active",
      onboarding_status: "active",
    }),
  });

  await rest("tenant_portal_settings", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      tenant_id: tenantId,
      website_status: "live",
      website_url: websiteUrl,
      domain,
      plan_name: "Launch",
      monthly_price_cents: 0,
      contract_start_on: new Date().toISOString().slice(0, 10),
    }),
  });

  await rest("tenant_subscriptions", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      tenant_id: tenantId,
      subscription_status: "none",
      standard_amount_cents: 0,
      current_effective_amount_cents: 0,
    }),
  });

  return tenantId;
}

const authUser = await findAuthUser();
if (!authUser?.id) {
  console.error("No Supabase Auth user found. Create the account first, then rerun.");
  process.exit(1);
}

const email = (authUser.email ?? clientEmail ?? "").toLowerCase();
const userId = authUser.id;

await rest("profiles", {
  method: "POST",
  headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
  body: JSON.stringify({
    id: userId,
    email,
    full_name: contactName,
    active: true,
  }),
});

const tenantId = await ensureTenant();

const { data: existingMembership } = await rest(
  `tenant_memberships?tenant_id=eq.${tenantId}&user_id=eq.${userId}&select=id,status,role_id`,
);

const membershipRow = {
  tenant_id: tenantId,
  user_id: userId,
  role_id: tenantOwnerRoleId,
  status: "active",
};

if (existingMembership?.[0]?.id) {
  const { res, data } = await rest(
    `tenant_memberships?id=eq.${existingMembership[0].id}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(membershipRow),
    },
  );
  if (!res.ok) {
    console.error("Membership update failed:", data);
    process.exit(1);
  }
  console.log(`Updated tenant_memberships for ${email} on ${tenantSlug}`);
} else {
  const { res, data } = await rest("tenant_memberships", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(membershipRow),
  });
  if (!res.ok) {
    console.error("Membership create failed:", data);
    process.exit(1);
  }
  console.log(`Created tenant_memberships for ${email} on ${tenantSlug}`);
}

console.log(`Portal client access ready for ${email} (${userId})`);
