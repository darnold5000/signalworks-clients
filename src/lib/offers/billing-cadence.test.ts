import { describe, expect, it } from "vitest";
import {
  cadenceAggregateLabel,
  cadenceDescription,
  cadenceSuffix,
  recurringCadence,
} from "@/lib/offers/billing-cadence";

describe("billing cadence", () => {
  it("defaults legacy recurring data to monthly", () => {
    expect(recurringCadence({ billing_interval: null, billing_interval_count: 1 })).toEqual({ interval: "month", intervalCount: 1 });
    expect(cadenceSuffix({ billing_interval: null, billing_interval_count: 1 })).toBe("/month");
  });

  it.each([
    ["month", 3, "Billed every 3 months", " every 3 months"],
    ["month", 6, "Billed every 6 months", " every 6 months"],
    ["year", 1, "Billed annually", "/year"],
    ["year", 2, "Billed every 2 years", " every 2 years"],
  ] as const)("formats %s:%s", (interval, billing_interval_count, description, suffix) => {
    const item = { billing_interval: interval, billing_interval_count };
    expect(cadenceDescription(item)).toBe(description);
    expect(cadenceSuffix(item)).toBe(suffix);
  });

  it("labels a shared annual aggregate accurately", () => {
    expect(cadenceAggregateLabel({ billing_interval: "year", billing_interval_count: 1 })).toBe("Recurring annually");
  });
});
