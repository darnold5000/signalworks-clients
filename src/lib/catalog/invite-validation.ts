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

const paidAddOnSchema = z.object({
  productKey: z.string().trim().min(1),
  monthlyPriceDollars: z.coerce.number().min(0),
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
    paidAddOns: z.array(paidAddOnSchema).max(20).default([]),
    setupFeeDollars: z.coerce.number().min(0).default(0),
    monthlyDiscountDollars: z.coerce.number().min(0).default(0),
    idempotencyKey: z.string().uuid().optional(),
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

    const overlap = data.paidAddOns.filter((addOn) =>
      data.productKeys.includes(addOn.productKey),
    );
    if (overlap.length > 0) {
      ctx.addIssue({
        code: "custom",
        message:
          "A product cannot be both bundled and a paid add-on on the same offer.",
        path: ["paidAddOns"],
      });
    }
  });

export type InviteClientRequest = z.infer<typeof inviteClientRequestSchema>;
