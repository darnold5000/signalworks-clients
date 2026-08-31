import { z } from "zod";
import { logTenantActivity } from "@/lib/activity/log-tenant-activity";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(50).optional().default(""),
  jobTitle: z.string().trim().max(120).optional().default(""),
  isPrimary: z.boolean().default(false),
  receivesProposals: z.boolean().default(false),
  receivesBilling: z.boolean().default(false),
  receivesNotifications: z.boolean().default(false),
});

export const createClientSchema = z
  .object({
    businessName: z.string().trim().min(2).max(200),
    websiteUrl: z.union([z.string().trim().url(), z.literal("")]).optional().default(""),
    domain: z.string().trim().max(255).optional().default(""),
    businessPhone: z.string().trim().max(50).optional().default(""),
    status: z.enum(["prospect", "active", "inactive"]).default("prospect"),
    contacts: z.array(contactSchema).max(25).default([]),
  })
  .superRefine((value, ctx) => {
    const emails = new Set<string>();
    value.contacts.forEach((contact, index) => {
      const email = contact.email.toLowerCase();
      if (emails.has(email)) {
        ctx.addIssue({
          code: "custom",
          path: ["contacts", index, "email"],
          message: "Each contact email must be unique for this client.",
        });
      }
      emails.add(email);
    });
    if (value.contacts.filter((contact) => contact.isPrimary).length > 1) {
      ctx.addIssue({
        code: "custom",
        path: ["contacts"],
        message: "Only one contact can be primary.",
      });
    }
  });

export type CreateClientInput = z.infer<typeof createClientSchema>;

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export async function createClientRecord(
  input: CreateClientInput,
  actorUserId: string | null,
) {
  const supabase = createServiceClient();
  const baseSlug = slugify(input.businessName) || "client";
  let slug = baseSlug;
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const { data } = await supabase.from(TABLES.tenants).select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = `${baseSlug}-${suffix}`;
  }

  const tenantStatus = input.status === "active" ? "active" : input.status === "inactive" ? "paused" : "onboarding";
  const internalStatus = input.status === "active" ? "active" : input.status === "inactive" ? "paused" : "prospect";
  const primary = input.contacts.find((contact) => contact.isPrimary) ?? input.contacts[0] ?? null;
  const billing = input.contacts.find((contact) => contact.receivesBilling) ?? null;

  const { data: tenant, error: tenantError } = await supabase
    .from(TABLES.tenants)
    .insert({ slug, display_name: input.businessName, status: tenantStatus, platform_category: "services" })
    .select("id")
    .single();
  if (tenantError || !tenant) throw new Error(tenantError?.message ?? "Could not create client.");

  const tenantId = tenant.id as string;
  try {
    const { error: profileError } = await supabase.from(TABLES.tenantProfiles).insert({
      tenant_id: tenantId,
      display_name: input.businessName,
      legal_business_name: input.businessName,
      primary_contact_name: primary?.name ?? null,
      primary_contact_email: primary?.email ?? null,
      primary_contact_phone: primary?.phone || null,
      billing_contact_name: billing?.name ?? null,
      billing_contact_email: billing?.email ?? null,
      website_url: input.websiteUrl || null,
      primary_domain: input.domain || null,
      internal_status: internalStatus,
      onboarding_status: input.status === "active" ? "onboarding_complete" : "not_started",
    });
    if (profileError) throw new Error(profileError.message);

    const { error: settingsError } = await supabase.from(TABLES.tenantPortalSettings).insert({
      tenant_id: tenantId,
      website_url: input.websiteUrl || null,
      domain: input.domain || null,
      support_phone: input.businessPhone || null,
      plan_name: null,
      monthly_price_cents: null,
      contract_start_on: null,
    });
    if (settingsError) throw new Error(settingsError.message);

    if (input.contacts.length > 0) {
      const { error: contactsError } = await supabase.from(TABLES.tenantContacts).insert(
        input.contacts.map((contact) => ({
          tenant_id: tenantId,
          name: contact.name,
          email: contact.email,
          phone: contact.phone || null,
          job_title: contact.jobTitle || null,
          contact_type: contact.isPrimary ? "owner" : contact.receivesBilling ? "billing" : "other",
          is_primary: contact.isPrimary || (!primary?.isPrimary && contact === input.contacts[0]),
          is_billing_contact: contact.receivesBilling,
          receives_proposals: contact.receivesProposals,
          receives_billing: contact.receivesBilling,
          receives_notifications: contact.receivesNotifications,
        })),
      );
      if (contactsError) throw new Error(contactsError.message);
    }

    await logTenantActivity({
      tenantId,
      actorUserId,
      actorType: "admin",
      action: "client.created",
      entityType: "tenant",
      entityId: tenantId,
      summary: `Created client “${input.businessName}” without a proposal or portal invite`,
      metadata: { contact_count: input.contacts.length },
    });
    return { tenantId, redirectTo: `/admin/clients/${tenantId}/overview` };
  } catch (error) {
    await supabase.from(TABLES.tenants).delete().eq("id", tenantId);
    throw error;
  }
}
