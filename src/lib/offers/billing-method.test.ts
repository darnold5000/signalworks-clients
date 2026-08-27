import { describe, expect, it } from "vitest";
import {
  buildOfferAcceptanceSnapshot,
  offerBillingMethodLabel,
  resolveOfferBillingMethod,
} from "@/lib/offers/billing-method";
import type { ClientOffer, ClientOfferItem } from "@/lib/database/phase1-types";

const offer = {
  id: "offer-1",
  tenant_id: "tenant-1",
  title: "MA5 Connect",
  status: "published",
  currency: "usd",
} as ClientOffer;

const item = {
  id: "item-1",
  offer_id: "offer-1",
  tenant_id: "tenant-1",
  item_type: "add_on",
  name: "MA5 Connect",
  quantity: 1,
  unit_amount_cents: 10999,
  billing_type: "recurring",
  billing_interval: "month",
  billing_interval_count: 1,
  is_selected: true,
  metadata: {},
} as ClientOfferItem;

const discount = {
  ...item,
  id: "discount-1",
  item_type: "discount",
  name: "Founding Partner Discount",
  unit_amount_cents: 5000,
  billing_type: "one_time",
  billing_interval: null,
  discount_type: "amount",
  discount_amount_cents: 5000,
  discount_duration_type: "forever",
  metadata: { discount_scope: "recurring" },
} as ClientOfferItem;

describe("proposal billing method", () => {
  it("defaults missing and null legacy values to Stripe Checkout", () => {
    expect(resolveOfferBillingMethod(offer)).toBe("stripe_checkout");
    expect(resolveOfferBillingMethod({ ...offer, billing_method: null })).toBe(
      "stripe_checkout",
    );
    expect(offerBillingMethodLabel(offer)).toBe("Stripe Checkout");
  });

  it("captures Proposal Only pricing and discount duration immutably", () => {
    const snapshot = buildOfferAcceptanceSnapshot({
      offer: { ...offer, billing_method: "proposal_only" },
      items: [item, discount],
      acceptedByUserId: "user-1",
      acceptedName: "Mike Example",
      acceptedEmail: "mike@example.com",
    });

    expect(snapshot.billing_method).toBe("proposal_only");
    expect(snapshot.items).toEqual([item, discount]);
    expect(snapshot.items[1].discount_duration_type).toBe("forever");
    expect(snapshot.totals.recurring_total_cents).toBe(5999);
    expect(snapshot.totals.initial_total_cents).toBe(0);
    expect(snapshot.accepted_by_user_id).toBe("user-1");
  });
});
