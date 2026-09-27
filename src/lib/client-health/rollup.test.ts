import { describe, expect, it } from "vitest";
import { rollupOperationsHealthStatus } from "@/lib/client-health/rollup";

describe("rollupOperationsHealthStatus", () => {
  it("ignores not_configured when rolling up", () => {
    expect(
      rollupOperationsHealthStatus(["not_configured", "healthy"]),
    ).toBe("healthy");
  });

  it("returns not_configured when nothing is configured", () => {
    expect(rollupOperationsHealthStatus(["not_configured"])).toBe(
      "not_configured",
    );
  });

  it("prefers critical over unknown", () => {
    expect(rollupOperationsHealthStatus(["unknown", "critical"])).toBe(
      "critical",
    );
  });

  it("prefers unknown over healthy", () => {
    expect(rollupOperationsHealthStatus(["healthy", "unknown"])).toBe(
      "unknown",
    );
  });
});
