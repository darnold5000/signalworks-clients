import { describe, expect, it } from "vitest";
import { formatSearchDemand, formatSearchQuery } from "./location";

describe("report search presentation", () => {
  it("formats a tested query with its market", () => {
    expect(formatSearchQuery("financial advisor Indianapolis Indiana", "Indianapolis, Indiana, United States")).toBe("financial advisor — Indianapolis, Indiana");
  });

  it("shows estimated monthly demand when persisted", () => {
    expect(formatSearchDemand("high", 1300)).toBe("High demand · ~1,300 searches/month");
    expect(formatSearchDemand("high", null)).toBe("High demand");
  });
});
