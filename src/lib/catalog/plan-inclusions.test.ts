import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAN_INCLUSIONS,
  DEFAULT_SETUP_INCLUSIONS,
  resolvePlanInclusions,
  resolveSetupInclusions,
} from "@/lib/catalog/plan-inclusions";

describe("stored plan inclusions", () => {
  it("falls back to defaults only for missing legacy values", () => {
    expect(resolvePlanInclusions(null)).toEqual(DEFAULT_PLAN_INCLUSIONS);
    expect(resolveSetupInclusions(undefined)).toEqual(DEFAULT_SETUP_INCLUSIONS);
  });

  it("preserves saved custom and empty values", () => {
    expect(resolvePlanInclusions(["Custom service"])).toEqual([
      "Custom service",
    ]);
    expect(resolveSetupInclusions([])).toEqual([]);
  });
});
