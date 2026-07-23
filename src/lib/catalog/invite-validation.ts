import { z } from "zod";
import { validateCustomPlanPrice } from "@/lib/catalog/build-invite-offer";

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

const serviceAddOnSchema = z.object({
  productKey: z.string().trim().min(1),
  monthlyPriceDollars: z.coerce.number().min(0),
  quantity: z.coerce.number().int().min(1).max(999).optional(),
});

const customPlatformComponentSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

const customServiceAddOnSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  monthlyPriceDollars: z.coerce.number().min(0),
  quantity: z.coerce.number().int().min(1).max(999).optional(),
});

export const inviteClientRequestSchema = z
  .object({
    businessName: z.string().trim().min(2).max(120),
    contactName: z.string().trim().max(120).optional().or(z.literal("")),
    email: z.string().trim().email(),
    phone: z.string().trim().max(50).optional().or(z.literal("")),
    websiteUrl: optionalUrl.optional().or(z.literal("")),
    domain: z.string().trim().max(200).optional().or(z.literal("")),
    planKey: z.enum(["brand", "launch", "platform", "custom"]),
    monthlyPriceDollars: z.coerce.number().min(0),
    productKeys: z.array(z.string().trim().min(1)).max(50).default([]),
    /** @deprecated use serviceAddOns */
    paidAddOns: z.array(serviceAddOnSchema).max(30).default([]),
    serviceAddOns: z.array(serviceAddOnSchema).max(30).default([]),
    customPlatformComponents: z
      .array(customPlatformComponentSchema)
      .max(20)
      .default([]),
    customServiceAddOns: z
      .array(customServiceAddOnSchema)
      .max(20)
      .default([]),
    setupFeeDollars: z.coerce.number().min(0).default(0),
    monthlyDiscountDollars: z.coerce.number().min(0).default(0),
    monthlyDiscountDurationMonths: z.coerce.number().int().min(0).max(120).default(0),
    idempotencyKey: z.string().uuid().optional(),
  })
  .transform((data) => {
    const serviceAddOns =
      data.serviceAddOns.length > 0 ? data.serviceAddOns : data.paidAddOns;
    return { ...data, serviceAddOns };
  })
  .superRefine((data, ctx) => {
    const monthlyPriceCents = Math.round(data.monthlyPriceDollars * 100);
    const customError = validateCustomPlanPrice(data.planKey, monthlyPriceCents);
    if (customError) {
      ctx.addIssue({
        code: "custom",
        message: customError,
        path: ["monthlyPriceDollars"],
      });
    }

    if (data.productKeys.includes("other")) {
      const named = data.customPlatformComponents.filter((row) => row.name.trim());
      if (named.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "Add at least one custom platform component name.",
          path: ["customPlatformComponents"],
        });
      }
    }
  });

export type InviteClientRequest = z.infer<typeof inviteClientRequestSchema>;
