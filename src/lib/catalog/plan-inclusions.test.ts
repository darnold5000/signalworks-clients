import { describe, expect, it } from "vitest";
import { resolvePlanInclusions, resolveSetupInclusions } from "@/lib/catalog/plan-inclusions";

describe("stored plan inclusions", () => {
  it("does not invent inclusions for missing configuration", () => {
    expect(resolvePlanInclusions(null)).toEqual([]);
    expect(resolveSetupInclusions(undefined)).toEqual([]);
  });

  it("preserves saved custom and empty values", () => {
    expect(resolvePlanInclusions(["Custom service"])).toEqual([
      "Custom service",
    ]);
    expect(resolveSetupInclusions([])).toEqual([]);
  });
});
