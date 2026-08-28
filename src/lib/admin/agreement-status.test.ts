import { describe, expect, it } from "vitest";
import { resolveAgreementAwareInternalStatus } from "@/lib/admin/agreement-status";
import type { ClientOfferStatus } from "@/lib/database/phase1-types";

function resolve(offerStatuses: ClientOfferStatus[]) {
  return resolveAgreementAwareInternalStatus({
    storedStatus: "awaiting_agreement",
    tenantStatus: "active",
    offerStatuses,
  });
}

describe("agreement-aware client status", () => {
  it.each(["published", "viewed"] satisfies ClientOfferStatus[])(
    "shows Awaiting agreement for an outstanding %s offer",
    (status) => {
      expect(resolve([status])).toBe("awaiting_agreement");
    },
  );

  it.each(["accepted", "purchased"] satisfies ClientOfferStatus[])(
    "clears stale Awaiting agreement for a terminal %s offer",
    (status) => {
      expect(resolve([status])).toBe("active");
    },
  );

  it("still awaits agreement when one accepted offer and one sent offer exist", () => {
    expect(resolve(["accepted", "published"])).toBe("awaiting_agreement");
  });

  it("does not await agreement for a purchased base offer and accepted add-on", () => {
    expect(resolve(["purchased", "accepted"])).toBe("active");
  });

  it("preserves unrelated stored client statuses", () => {
    expect(
      resolveAgreementAwareInternalStatus({
        storedStatus: "past_due",
        tenantStatus: "active",
        offerStatuses: ["accepted"],
      }),
    ).toBe("past_due");
  });

  it("falls back to the tenant's normal non-active status when agreement state is stale", () => {
    expect(
      resolveAgreementAwareInternalStatus({
        storedStatus: "awaiting_agreement",
        tenantStatus: "paused",
        offerStatuses: ["canceled"],
      }),
    ).toBe("paused");
  });
});
