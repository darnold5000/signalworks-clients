/**
 * Production smoke test — run only when explicitly enabled:
 *   SMOKE_PROD=1 npm test -- src/lib/offers/smoke-production-commercial.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClientRecord } from "@/lib/admin/client-creation";
import {
  applyCommercialConfigToOffer,
  assertDraftOfferEditable,
  OfferNotEditableError,
} from "@/lib/offers/apply-commercial-config-to-offer";
import type { CommercialOfferConfig } from "@/lib/catalog/commercial-config-validation";
import { parseCommercialConfigFromOffer } from "@/lib/offers/parse-commercial-config-from-offer";
import {
  hasManagedCommercialPricing,
  partitionOfferItems,
} from "@/lib/offers/managed-commercial-items";
import {
  calculateAmountDueFirstCycle,
  calculateOfferTotals,
} from "@/lib/offers/calculate-totals";
import { getPaidAddOnsByKeys, getProductsByKeys } from "@/lib/catalog/queries";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

if (!globalThis.WebSocket) {
  globalThis.WebSocket = class {} as typeof WebSocket;
}

const enabled = process.env.SMOKE_PROD === "1";
const describeProd = enabled ? describe : describe.skip;

describeProd("production commercial proposal smoke", () => {
  const stamp = Date.now();
  let tenantId = "";
  let offerId = "";
  let supabase: ReturnType<typeof createServiceClient>;
  let platformKey = "website";
  let addOnKey = "advanced_seo";

  async function getOfferWithItemsService(offerIdToLoad: string) {
    const { data: offer } = await supabase
      .from(TABLES.clientOffers)
      .select("*")
      .eq("id", offerIdToLoad)
      .maybeSingle();
    if (!offer) return null;
    const { data: items } = await supabase
      .from(TABLES.clientOfferItems)
      .select("*")
      .eq("offer_id", offerIdToLoad)
      .order("sort_order", { ascending: true });
    const { data: features } = await supabase
      .from(TABLES.clientOfferFeatures)
      .select("*")
      .eq("offer_id", offerIdToLoad)
      .order("sort_order", { ascending: true });
    return {
      ...(offer as import("@/lib/database/phase1-types").ClientOffer),
      items: (items as import("@/lib/database/phase1-types").ClientOfferItem[]) ?? [],
      features:
        (features as import("@/lib/database/phase1-types").ClientOfferFeature[]) ?? [],
    };
  }

  const baseConfig = (): CommercialOfferConfig => ({
    planKey: "launch",
    monthlyPriceDollars: 49.99,
    productKeys: [platformKey],
    serviceAddOns: [
      {
        productKey: addOnKey,
        monthlyPriceDollars: 12.5,
        quantity: 2,
        billingType: "recurring",
      },
    ],
    customPlatformComponents: [],
    customServiceAddOns: [
      {
        name: "Smoke one-time setup help",
        monthlyPriceDollars: 75,
        billingType: "one_time",
      },
    ],
    setupFeeDollars: 25,
    monthlyDiscountDollars: 10,
    monthlyDiscountDurationMonths: 3,
    planInclusions: ["Smoke website build", "Smoke hosting"],
    setupInclusions: ["Smoke DNS setup"],
  });

  beforeAll(async () => {
    supabase = createServiceClient();
    const [platforms, addOns] = await Promise.all([
      getProductsByKeys(["website"]),
      getPaidAddOnsByKeys(["advanced_seo"]),
    ]);
    if (platforms[0]) platformKey = platforms[0].product_key;
    if (addOns[0]) addOnKey = addOns[0].product_key;

    const created = await createClientRecord(
      {
        businessName: `SMOKE Commercial Test ${stamp}`,
        websiteUrl: "",
        domain: "",
        businessPhone: "",
        status: "prospect",
        websiteStatus: "not_set",
        contacts: [
          {
            name: "Smoke Primary",
            email: `smoke-primary-${stamp}@example.test`,
            phone: "",
            jobTitle: "",
            isPrimary: true,
            receivesProposals: true,
            receivesBilling: false,
            receivesNotifications: false,
          },
          {
            name: "Smoke Secondary",
            email: `smoke-secondary-${stamp}@example.test`,
            phone: "",
            jobTitle: "",
            isPrimary: false,
            receivesProposals: true,
            receivesBilling: false,
            receivesNotifications: false,
          },
        ],
      },
      null,
    );
    tenantId = created.tenantId;

    const { data: offer, error } = await supabase
      .from(TABLES.clientOffers)
      .insert({
        tenant_id: tenantId,
        title: `SMOKE Proposal ${stamp}`,
        status: "draft",
        billing_method: "stripe_checkout",
        currency: "usd",
        requires_terms_acceptance: true,
        plan_inclusions: [],
        setup_inclusions: [],
        subtotal_cents: 0,
        discount_total_cents: 0,
        initial_total_cents: 0,
        recurring_total_cents: 0,
      })
      .select("id")
      .single();
    if (error || !offer) throw new Error(error?.message ?? "Could not create offer");
    offerId = offer.id as string;
  });

  afterAll(async () => {
    if (!tenantId) return;
    await supabase.from(TABLES.clientOffers).delete().eq("tenant_id", tenantId);
    await supabase.from(TABLES.tenantContacts).delete().eq("tenant_id", tenantId);
    await supabase.from(TABLES.tenantPortalSettings).delete().eq("tenant_id", tenantId);
    await supabase.from(TABLES.tenantProfiles).delete().eq("tenant_id", tenantId);
    await supabase.from(TABLES.tenants).delete().eq("id", tenantId);
  });

  it("applies catalog commercial config and calculates totals", async () => {
    const offer = await applyCommercialConfigToOffer({
      tenantId,
      offerId,
      config: baseConfig(),
    });
    expect(offer).toBeTruthy();
    expect(hasManagedCommercialPricing(offer!.items)).toBe(true);

    const totals = calculateOfferTotals(offer!.items);
    expect(totals.recurring_total_cents).toBeGreaterThan(0);
    expect(totals.initial_total_cents).toBeGreaterThan(0);
    expect(calculateAmountDueFirstCycle(totals)).toBeGreaterThan(0);
    expect(offer!.plan_inclusions).toEqual(baseConfig().planInclusions);
  });

  it("hydrates saved commercial config from stored offer items", async () => {
    const offer = await getOfferWithItemsService(offerId);
    expect(offer).toBeTruthy();
    const hydrated = parseCommercialConfigFromOffer(offer!, offer!.items);
    expect(hydrated?.planKey).toBe("launch");
    expect(hydrated?.monthlyPriceDollars).toBe(49.99);
    expect(hydrated?.productKeys).toContain(platformKey);
    expect(hydrated?.serviceAddOns[0]?.productKey).toBe(addOnKey);
    expect(hydrated?.serviceAddOns[0]?.quantity).toBe(2);
    expect(hydrated?.setupFeeDollars).toBe(25);
    expect(hydrated?.monthlyDiscountDollars).toBe(10);
    expect(hydrated?.monthlyDiscountDurationMonths).toBe(3);
    expect(hydrated?.planInclusions).toEqual(baseConfig().planInclusions);
  });

  it("re-saves edited commercial config without duplicating managed rows", async () => {
    const edited: CommercialOfferConfig = {
      ...baseConfig(),
      monthlyPriceDollars: 59.99,
      monthlyDiscountDollars: 5,
      monthlyDiscountDurationMonths: 0,
      serviceAddOns: [
        {
          productKey: addOnKey,
          monthlyPriceDollars: 20,
          quantity: 1,
          billingType: "recurring",
        },
      ],
    };
    const offer = await applyCommercialConfigToOffer({
      tenantId,
      offerId,
      config: edited,
    });
    const managed = offer!.items.filter(
      (item) => item.item_type === "base_plan" || item.item_type === "discount",
    );
    expect(managed.filter((item) => item.item_type === "base_plan")).toHaveLength(1);
    expect(parseCommercialConfigFromOffer(offer!, offer!.items)?.monthlyPriceDollars).toBe(
      59.99,
    );
  });

  it("preserves manual custom lines when catalog pricing is re-applied", async () => {
    await supabase.from(TABLES.clientOfferItems).insert({
      offer_id: offerId,
      tenant_id: tenantId,
      item_type: "custom_service",
      name: "Smoke manual consulting",
      quantity: 1,
      unit_amount_cents: 5000,
      billing_type: "one_time",
      billing_interval_count: 1,
      is_optional: false,
      is_selected: true,
      sort_order: 200,
      metadata: {},
    });

    const before = await getOfferWithItemsService(offerId);
    const { manual: manualBefore } = partitionOfferItems(before!.items);
    expect(manualBefore.some((item) => item.name === "Smoke manual consulting")).toBe(
      true,
    );

    await applyCommercialConfigToOffer({
      tenantId,
      offerId,
      config: baseConfig(),
    });

    const after = await getOfferWithItemsService(offerId);
    const { managed, manual } = partitionOfferItems(after!.items);
    expect(managed.length).toBeGreaterThan(0);
    expect(manual.some((item) => item.name === "Smoke manual consulting")).toBe(true);
    expect(
      managed.filter((item) => item.item_type === "base_plan"),
    ).toHaveLength(1);
  });

  it("allows billing method changes on draft", async () => {
    await supabase
      .from(TABLES.clientOffers)
      .update({ billing_method: "proposal_only" })
      .eq("id", offerId)
      .eq("status", "draft");
    const offer = await getOfferWithItemsService(offerId);
    expect(offer?.billing_method).toBe("proposal_only");

    await supabase
      .from(TABLES.clientOffers)
      .update({ billing_method: "stripe_checkout" })
      .eq("id", offerId)
      .eq("status", "draft");
    const restored = await getOfferWithItemsService(offerId);
    expect(restored?.billing_method).toBe("stripe_checkout");
  });

  it("rejects commercial config mutations on non-draft offers", async () => {
    await supabase
      .from(TABLES.clientOffers)
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", offerId);

    await expect(assertDraftOfferEditable(tenantId, offerId)).rejects.toBeInstanceOf(
      OfferNotEditableError,
    );
    await expect(
      applyCommercialConfigToOffer({ tenantId, offerId, config: baseConfig() }),
    ).rejects.toThrow(/draft/i);

    await supabase
      .from(TABLES.clientOffers)
      .update({ status: "draft", published_at: null })
      .eq("id", offerId);
  });

  it("leaves Ton Tavern data untouched", async () => {
    const { data: tonTavern } = await supabase
      .from(TABLES.tenants)
      .select("id, slug, display_name")
      .eq("slug", "ton-tavern-fitness")
      .maybeSingle();
    expect(tonTavern?.display_name).toBeTruthy();

    const { data: smokeOnTon } = await supabase
      .from(TABLES.clientOffers)
      .select("id, title")
      .eq("tenant_id", tonTavern!.id)
      .ilike("title", "%SMOKE%");
    expect(smokeOnTon ?? []).toHaveLength(0);
    expect(tonTavern?.slug).toBe("ton-tavern-fitness");
  });
});
