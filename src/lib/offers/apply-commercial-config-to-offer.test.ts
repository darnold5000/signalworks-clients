import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildInviteOfferItemRows } from "@/lib/catalog/build-invite-offer";
import type { CommercialOfferConfig } from "@/lib/catalog/commercial-config-validation";
import type { ClientOfferItem } from "@/lib/database/phase1-types";

const mocks = vi.hoisted(() => ({
  getPlanTemplateByKey: vi.fn(),
  getProductsByKeys: vi.fn(),
  getPaidAddOnsByKeys: vi.fn(),
  getOfferWithItemsWithServiceClient: vi.fn(),
  from: vi.fn(),
  deleteIn: vi.fn(),
}));

vi.mock("@/lib/catalog/queries", () => ({
  getPlanTemplateByKey: mocks.getPlanTemplateByKey,
  getProductsByKeys: mocks.getProductsByKeys,
  getPaidAddOnsByKeys: mocks.getPaidAddOnsByKeys,
}));

vi.mock("@/lib/offers/queries", () => ({
  getOfferWithItemsWithServiceClient: mocks.getOfferWithItemsWithServiceClient,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({ from: mocks.from }),
}));

import {
  applyCommercialConfigToOffer,
  assertDraftOfferEditable,
  OfferNotEditableError,
} from "@/lib/offers/apply-commercial-config-to-offer";

const config: CommercialOfferConfig = {
  planKey: "launch",
  monthlyPriceDollars: 50,
  productKeys: ["website"],
  serviceAddOns: [],
  customPlatformComponents: [],
  customServiceAddOns: [],
  setupFeeDollars: 25,
  monthlyDiscountDollars: 10,
  monthlyDiscountDurationMonths: 3,
  planInclusions: ["Website"],
  setupInclusions: ["Hosting"],
};

const manualItem: ClientOfferItem = {
  id: "manual-1",
  offer_id: "offer-1",
  tenant_id: "tenant-1",
  item_type: "custom_service",
  name: "Custom consulting",
  description: null,
  quantity: 1,
  unit_amount_cents: 9000,
  billing_type: "one_time",
  billing_interval: null,
  billing_interval_count: 1,
  discount_type: null,
  discount_amount_cents: null,
  discount_percent: null,
  discount_duration_type: null,
  discount_duration_months: null,
  stripe_product_id: null,
  stripe_price_id: null,
  stripe_coupon_id: null,
  is_optional: false,
  is_selected: true,
  sort_order: 50,
  metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("applyCommercialConfigToOffer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPlanTemplateByKey.mockResolvedValue({
      plan_key: "launch",
      name: "Launch",
      billing_interval: "month",
    });
    mocks.getProductsByKeys.mockResolvedValue([
      { product_key: "website", name: "Website" },
    ]);
    mocks.getPaidAddOnsByKeys.mockResolvedValue([]);

    const managedItems = buildInviteOfferItemRows({
      tenantId: "tenant-1",
      offerId: "offer-1",
      plan: {
        plan_key: "launch",
        name: "Launch",
        monthly_price_cents: 10000,
        billing_interval: "month",
      },
      products: [],
    }).map((row, index) => ({
      ...row,
      id: `managed-${index}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    mocks.getOfferWithItemsWithServiceClient.mockImplementation(async () => ({
      id: "offer-1",
      tenant_id: "tenant-1",
      status: "draft",
      items: [...managedItems, manualItem],
    }));

    mocks.deleteIn.mockResolvedValue({ error: null });
    const insert = vi.fn().mockImplementation(() => ({
      select: () => ({
        data: buildInviteOfferItemRows({
          tenantId: "tenant-1",
          offerId: "offer-1",
          plan: {
            plan_key: "launch",
            name: "Launch",
            monthly_price_cents: 5000,
            billing_interval: "month",
          },
          products: [{ product_key: "website", name: "Website" }],
          planInclusions: [
            { product_key: "plan_inclusion_website", name: "Website" },
          ],
          setupInclusions: [
            { product_key: "setup_inclusion_hosting", name: "Hosting" },
          ],
          extras: {
            setup_fee_cents: 2500,
            monthly_discount_cents: 1000,
            monthly_discount_duration_months: 3,
          },
        }).map((row, index) => ({
          ...row,
          id: `new-${index}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })),
        error: null,
      }),
    }));
    const updateEq = vi.fn().mockResolvedValue({ error: null });

    mocks.from.mockImplementation((table: string) => {
      if (table === "client_offers") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { status: "draft", tenant_id: "tenant-1" } }),
            }),
          }),
          update: () => ({
            eq: () => ({
              eq: updateEq,
            }),
          }),
        };
      }
      if (table === "client_offer_items") {
        return {
          delete: () => ({ in: mocks.deleteIn }),
          insert,
        };
      }
      return {};
    });
  });

  it("rejects non-draft offers", async () => {
    mocks.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { status: "published", tenant_id: "tenant-1" } }),
        }),
      }),
    }));

    await expect(
      assertDraftOfferEditable("tenant-1", "offer-1"),
    ).rejects.toBeInstanceOf(OfferNotEditableError);
  });

  it("replaces managed rows and preserves manual custom lines", async () => {
    const offer = await applyCommercialConfigToOffer({
      tenantId: "tenant-1",
      offerId: "offer-1",
      config,
    });

    const deletedIds = mocks.deleteIn.mock.calls[0]?.[1] as string[];
    expect(deletedIds?.every((id) => id.startsWith("managed-"))).toBe(true);
    expect(deletedIds).not.toContain("manual-1");
    expect(offer).toBeTruthy();
  });
});
