import { z } from "zod";
import {
  commercialOfferConfigSchema,
  serviceAddOnConfigSchema,
} from "@/lib/catalog/commercial-config-validation";

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

export const inviteClientRequestSchema = commercialOfferConfigSchema
  .extend({
    businessName: z.string().trim().min(2).max(120),
    contactName: z.string().trim().max(120).optional().or(z.literal("")),
    email: z.string().trim().email(),
    phone: z.string().trim().max(50).optional().or(z.literal("")),
    websiteUrl: optionalUrl.optional().or(z.literal("")),
    domain: z.string().trim().max(200).optional().or(z.literal("")),
    /** @deprecated use serviceAddOns */
    paidAddOns: z.array(serviceAddOnConfigSchema).max(30).default([]),
    idempotencyKey: z.string().uuid().optional(),
  })
  .transform((data) => {
    const serviceAddOns =
      data.serviceAddOns.length > 0 ? data.serviceAddOns : data.paidAddOns;
    return { ...data, serviceAddOns };
  });

export type InviteClientRequest = z.infer<typeof inviteClientRequestSchema>;
