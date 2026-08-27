import { describe, expect, it } from "vitest";
import type { ClientOfferItem } from "@/lib/database/phase1-types";
import { assertCheckoutCompatibleCadences } from "@/lib/offers/checkout";

const item = (interval: "month" | "year", count: number) => ({
  billing_type: "recurring",
  billing_interval: interval,
  billing_interval_count: count,
}) as ClientOfferItem;

describe("Stripe Checkout cadence compatibility", () => {
  it("allows recurring items sharing one cadence", () => {
    expect(() => assertCheckoutCompatibleCadences([item("month", 3), item("month", 3)])).not.toThrow();
  });

  it("rejects mixed recurring cadences before Checkout", () => {
    expect(() => assertCheckoutCompatibleCadences([item("month", 1), item("year", 1)])).toThrow(/cannot create one subscription with mixed billing frequencies/i);
  });
});
