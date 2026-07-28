import { z } from "zod";

const optionalText = z.string().trim().max(500).optional().nullable();

export const tenantProfileUpdateSchema = z.object({
  legal_business_name: optionalText,
  display_name: optionalText,
  business_type: optionalText,
  primary_contact_name: optionalText,
  primary_contact_email: z.string().trim().email().optional().nullable().or(z.literal("")),
  primary_contact_phone: optionalText,
  billing_contact_name: optionalText,
  billing_contact_email: z.string().trim().email().optional().nullable().or(z.literal("")),
  website_url: z.string().trim().url().optional().nullable().or(z.literal("")),
  primary_domain: optionalText,
  support_email: z.string().trim().email().optional().nullable().or(z.literal("")),
  address_line_1: optionalText,
  address_line_2: optionalText,
  city: optionalText,
  state: optionalText,
  postal_code: optionalText,
  country: z.string().trim().min(2).max(2).optional(),
  internal_status: z
    .enum([
      "prospect",
      "invited",
      "onboarding",
      "awaiting_agreement",
      "awaiting_payment",
      "active",
      "past_due",
      "paused",
      "canceled",
      "archived",
    ])
    .optional(),
});

export type TenantProfileUpdateInput = z.infer<typeof tenantProfileUpdateSchema>;
