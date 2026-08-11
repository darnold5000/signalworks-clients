import { describe, expect, it } from "vitest";
import { demandLevelForVolume, normalizeDemand } from "./normalize";
import { opportunityForQuery } from "./opportunity";

describe("search demand and opportunities", () => {
  it("uses transparent demand thresholds", () => {
    expect(demandLevelForVolume(500)).toBe("high");
    expect(demandLevelForVolume(100)).toBe("moderate");
    expect(demandLevelForVolume(20)).toBe("low");
    expect(demandLevelForVolume(1)).toBe("very_low");
    expect(demandLevelForVolume(null)).toBe("unavailable");
  });

  it("does not turn missing demand into zero demand", () => {
    const demand = normalizeDemand({ query: "financial advisor Indianapolis", searchVolume: null, checkedAt: "now" });
    expect(demand.monthlySearchVolume).toBeNull();
    expect(demand.demandLevel).toBe("unavailable");
  });

  it("makes high demand outside the top 30 a high-priority opportunity", () => {
    const opportunity = opportunityForQuery({ query: "financial advisor Indianapolis", type: "discovery", service: "financial advisor", position: null, found: false, rankingUrl: null, checkedAt: "now", searchEngine: "google", location: "Indianapolis" }, normalizeDemand({ query: "financial advisor Indianapolis", searchVolume: 1000, checkedAt: "now" }));
    expect(opportunity.label).toBe("high_priority");
    expect(opportunity.score).toBeGreaterThan(70);
  });

  it("treats a top-three ranking as already strong", () => {
    const opportunity = opportunityForQuery({ query: "financial advisor Indianapolis", type: "discovery", service: "financial advisor", position: 2, found: true, rankingUrl: "https://example.com", checkedAt: "now", searchEngine: "google", location: "Indianapolis" }, normalizeDemand({ query: "financial advisor Indianapolis", searchVolume: 1000, checkedAt: "now" }));
    expect(opportunity.label).toBe("already_strong");
  });
});
