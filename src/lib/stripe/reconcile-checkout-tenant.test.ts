import { describe, expect, it } from "vitest";
import { reconcileCheckoutTenant } from "@/lib/stripe/reconcile-checkout-tenant";

describe("reconcileCheckoutTenant", () => {
  it("uses metadata when no purchase or offer was loaded", () => {
    expect(
      reconcileCheckoutTenant({
        metadataTenantId: "tenant-meta",
      }),
    ).toBe("tenant-meta");
  });

  it("prefers the purchase tenant and rejects metadata mismatch", () => {
    expect(
      reconcileCheckoutTenant({
        metadataTenantId: "tenant-meta",
        purchaseTenantId: "tenant-purchase",
      }),
    ).toBeNull();
    expect(
      reconcileCheckoutTenant({
        metadataTenantId: "tenant-a",
        purchaseTenantId: "tenant-a",
      }),
    ).toBe("tenant-a");
  });

  it("fails closed when a referenced purchase or offer is missing", () => {
    expect(
      reconcileCheckoutTenant({
        metadataTenantId: "tenant-a",
        purchaseTenantId: null,
      }),
    ).toBeNull();
    expect(
      reconcileCheckoutTenant({
        metadataTenantId: "tenant-a",
        offerTenantId: null,
      }),
    ).toBeNull();
  });

  it("rejects purchase vs offer tenant mismatch", () => {
    expect(
      reconcileCheckoutTenant({
        metadataTenantId: "tenant-a",
        purchaseTenantId: "tenant-a",
        offerTenantId: "tenant-b",
      }),
    ).toBeNull();
  });
});
