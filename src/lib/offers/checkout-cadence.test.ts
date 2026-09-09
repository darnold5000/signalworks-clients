import { describe, expect, it } from "vitest";
import type { ClientOfferItem } from "@/lib/database/phase1-types";
import { buildOfferCheckoutStages } from "@/lib/offers/checkout";

const item = (interval: "month" | "year", count: number) => ({
  billing_type: "recurring",
  billing_interval: interval,
  billing_interval_count: count,
  stripe_price_id: `price_${interval}_${count}`,
  is_selected: true,
}) as ClientOfferItem;

const oneTime = {
  ...item("month", 1),
  id: "setup",
  billing_type: "one_time",
  billing_interval: null,
  stripe_price_id: "price_setup",
} as ClientOfferItem;

describe("Stripe Checkout cadence compatibility", () => {
  it("uses one stage for recurring items sharing one cadence", () => {
    expect(buildOfferCheckoutStages([item("month", 3), item("month", 3)])).toHaveLength(1);
  });

  it("splits mixed recurring cadences into monthly then annual Checkout stages", () => {
    const stages = buildOfferCheckoutStages([item("month", 1), item("year", 1), oneTime]);
    expect(stages.map((stage) => stage.cadence)).toEqual(["month", "year"]);
    expect(stages.map((stage) => stage.items.length)).toEqual([2, 1]);
    expect(stages[0]!.items).toContain(oneTime);
  });

  it("uses one annual stage for annual-only proposals", () => {
    expect(buildOfferCheckoutStages([item("year", 1)])).toMatchObject([
      { cadence: "year" },
    ]);
  });
});
