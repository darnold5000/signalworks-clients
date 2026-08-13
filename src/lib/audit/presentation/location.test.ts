import { describe, expect, it } from "vitest";
import { formatCustomerSearch, formatSearchArea, formatSearchDemand, formatSearchQuery } from "./location";

describe("report search presentation", () => {
  it("formats a tested query with its market", () => {
    expect(formatSearchQuery("financial advisor Indianapolis Indiana", "Indianapolis, Indiana, United States")).toBe("financial advisor — Indianapolis, Indiana");
  });

  it("shows estimated monthly demand when persisted", () => {
    expect(formatSearchDemand("high", 1300)).toBe("High demand · ~1,300 searches/month");
    expect(formatSearchDemand("high", null)).toBe("High demand");
    expect(formatSearchDemand("very_low", 0)).toBe("Very low demand · 0 searches/month");
  });

  it("keeps the customer phrase and search area separate", () => {
    expect(formatCustomerSearch("basketball training", "basketball training", "Sheridan,Indiana,United States")).toBe("basketball training");
    expect(formatSearchArea("Sheridan,Indiana,United States")).toBe("Sheridan, Indiana");
  });
});
