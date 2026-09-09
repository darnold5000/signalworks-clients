import { describe, expect, it } from "vitest";
import {
  checkoutSessionCompleted,
  checkoutStateAfterCompletedStage,
} from "@/lib/offers/checkout-state";

describe("purchase checkout state", () => {
  it("keeps a mixed purchase partial after monthly stage success", () => {
    expect(
      checkoutStateAfterCompletedStage({ cadence: "month", finalStage: false }),
    ).toBe("monthly_complete");
  });

  it("marks the purchase complete after the final annual stage", () => {
    expect(
      checkoutStateAfterCompletedStage({ cadence: "year", finalStage: true }),
    ).toBe("complete");
  });

  it("does not treat a complete browser redirect with unpaid payment as paid", () => {
    expect(
      checkoutSessionCompleted({ status: "complete", payment_status: "unpaid" }),
    ).toBe(false);
  });
});
