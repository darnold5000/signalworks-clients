import { z } from "zod";
import { validateCustomPlanPrice } from "@/lib/catalog/build-invite-offer";
import {
  DEFAULT_PLAN_INCLUSIONS,
  DEFAULT_SETUP_INCLUSIONS,
} from "@/lib/catalog/plan-inclusions";
import { isPlaceholderOfferItemName } from "@/lib/offers/offer-item-validation";

export const PLAN_KEYS = [
  "brand",
  "growth",
  "launch",
  "platform",
  "custom",
] as const;

export type CommercialPlanKey = (typeof PLAN_KEYS)[number];

export const serviceAddOnConfigSchema = z.object({
  productKey: z.string().trim().min(1),
  monthlyPriceDollars: z.coerce.number().min(0),
  quantity: z.coerce.number().int().min(1).max(999).optional(),
  billingType: z.enum(["recurring", "one_time"]).optional(),
});

export const platformPricingModeSchema = z.enum([
  "included",
  "one_time",
  "monthly",
]);

export const platformComponentPricingSchema = z.object({
  productKey: z.string().trim().min(1),
  pricingMode: platformPricingModeSchema.default("included"),
  amountDollars: z.coerce.number().min(0).default(0),
});

export const customPlatformComponentConfigSchema = z.object({
  name: z.string().trim().min(1).max(200),
  pricingMode: platformPricingModeSchema.default("included"),
  amountDollars: z.coerce.number().min(0).default(0),
});

export const customServiceAddOnConfigSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  monthlyPriceDollars: z.coerce.number().min(0),
  quantity: z.coerce.number().int().min(1).max(999).optional(),
  billingType: z.enum(["recurring", "one_time"]).optional(),
});

const inclusionListSchema = z.array(z.string().trim().min(1).max(200)).max(50);

export const commercialOfferConfigSchema = z
  .object({
    planKey: z.enum(PLAN_KEYS),
    monthlyPriceDollars: z.coerce.number().min(0),
    productKeys: z.array(z.string().trim().min(1)).max(50).default([]),
    platformComponentPricing: z
      .array(platformComponentPricingSchema)
      .max(50)
      .default([]),
    serviceAddOns: z.array(serviceAddOnConfigSchema).max(30).default([]),
    customPlatformComponents: z
      .array(customPlatformComponentConfigSchema)
      .max(20)
      .default([]),
    customServiceAddOns: z
      .array(customServiceAddOnConfigSchema)
      .max(20)
      .default([]),
    setupFeeDollars: z.coerce.number().min(0).default(0),
    monthlyDiscountDollars: z.coerce.number().min(0).default(0),
    monthlyDiscountDurationMonths: z.coerce
      .number()
      .int()
      .min(0)
      .max(120)
      .default(0),
    planInclusions: inclusionListSchema.default([...DEFAULT_PLAN_INCLUSIONS]),
    setupInclusions: inclusionListSchema.default([...DEFAULT_SETUP_INCLUSIONS]),
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
      const named = data.customPlatformComponents.filter((row) =>
        row.name.trim(),
      );
      if (named.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "Add at least one custom platform component name.",
          path: ["customPlatformComponents"],
        });
      }
      for (const row of named) {
        if (isPlaceholderOfferItemName(row.name)) {
          ctx.addIssue({
            code: "custom",
            message: "Use a meaningful name for each custom platform component.",
            path: ["customPlatformComponents"],
          });
        }
      }
    }

    const selectedCatalogKeys = new Set(
      data.productKeys.filter((key) => key !== "other"),
    );
    const seenPricingKeys = new Set<string>();
    for (const row of data.platformComponentPricing) {
      if (!selectedCatalogKeys.has(row.productKey)) {
        ctx.addIssue({
          code: "custom",
          message: "Platform pricing must belong to a selected component.",
          path: ["platformComponentPricing"],
        });
      }
      if (seenPricingKeys.has(row.productKey)) {
        ctx.addIssue({
          code: "custom",
          message: "Each platform component can have only one price.",
          path: ["platformComponentPricing"],
        });
      }
      seenPricingKeys.add(row.productKey);
    }

    for (const row of data.customServiceAddOns) {
      if (isPlaceholderOfferItemName(row.name)) {
        ctx.addIssue({
          code: "custom",
          message: "Use a meaningful name for each custom add-on.",
          path: ["customServiceAddOns"],
        });
      }
    }
  });

export type CommercialOfferConfig = z.infer<typeof commercialOfferConfigSchema>;

export function defaultCommercialOfferConfig(
  planKey: CommercialPlanKey = "launch",
): CommercialOfferConfig {
  return commercialOfferConfigSchema.parse({
    planKey,
    monthlyPriceDollars: 0,
    productKeys: [],
    platformComponentPricing: [],
    serviceAddOns: [],
    customPlatformComponents: [],
    customServiceAddOns: [],
    setupFeeDollars: 0,
    monthlyDiscountDollars: 0,
    monthlyDiscountDurationMonths: 0,
    planInclusions: [...DEFAULT_PLAN_INCLUSIONS],
    setupInclusions: [...DEFAULT_SETUP_INCLUSIONS],
  });
}
