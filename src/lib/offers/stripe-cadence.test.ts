import { describe, expect, it } from "vitest";
import type { ClientOfferItem } from "@/lib/database/phase1-types";
import { stripeRecurringParams } from "@/lib/offers/stripe-catalog";

describe("Stripe recurring Price cadence", () => {
  it("passes annual interval and interval_count", () => {
    expect(stripeRecurringParams({ billing_interval: "year", billing_interval_count: 1 } as ClientOfferItem)).toEqual({ interval: "year", interval_count: 1 });
  });

  it("passes quarterly interval and interval_count", () => {
    expect(stripeRecurringParams({ billing_interval: "month", billing_interval_count: 3 } as ClientOfferItem)).toEqual({ interval: "month", interval_count: 3 });
  });
});
