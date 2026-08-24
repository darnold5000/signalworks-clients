import { describe, expect, it } from "vitest";
import {
  basePlanFromPurchaseSnapshot,
  resolveAggregateTenantStatus,
} from "@/lib/stripe-sync";

describe("multi-subscription Stripe synchronization", () => {
  it("keeps a tenant active while any subscription remains healthy", () => {
    expect(resolveAggregateTenantStatus(["active", "past_due"])).toBe(
      "active",
    );
    expect(resolveAggregateTenantStatus(["canceled", "trialing"])).toBe(
      "active",
    );
  });

  it("only cancels a tenant after every real subscription is canceled", () => {
    expect(resolveAggregateTenantStatus(["canceled", "canceled", "none"])).toBe(
      "canceled",
    );
    expect(resolveAggregateTenantStatus(["past_due", "canceled"])).toBe(
      "past_due",
    );
  });

  it("does not treat an add-on-only purchase as a replacement plan", () => {
    expect(
      basePlanFromPurchaseSnapshot({
        items: [
          {
            item_type: "add_on",
            name: "Managed Email",
            unit_amount_cents: 2900,
            quantity: 1,
            is_selected: true,
          },
        ],
      }),
    ).toBeNull();
  });

  it("extracts the base plan price rather than the combined offer total", () => {
    expect(
      basePlanFromPurchaseSnapshot({
        items: [
          {
            item_type: "base_plan",
            name: "Launch",
            unit_amount_cents: 14999,
            quantity: 1,
            is_selected: true,
          },
          {
            item_type: "add_on",
            name: "Managed Email",
            unit_amount_cents: 2900,
            quantity: 1,
            is_selected: true,
          },
        ],
      }),
    ).toEqual({ name: "Launch", monthlyPriceCents: 14999 });
  });
});
