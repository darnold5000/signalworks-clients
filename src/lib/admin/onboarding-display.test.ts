import { describe, expect, it } from "vitest";
import { resolveAdminOnboardingStage } from "@/lib/admin/onboarding-display";

describe("resolveAdminOnboardingStage", () => {
  it("keeps a newly created active client at Not Started", () => {
    expect(resolveAdminOnboardingStage({
      storedStatus: "not_started",
      portalActive: false,
      commercialState: "not_established",
    })).toBe("Not Started");
  });

  it("normalizes the legacy client-first false-complete shape without a data edit", () => {
    expect(resolveAdminOnboardingStage({
      storedStatus: "onboarding_complete",
      portalActive: false,
      commercialState: "not_established",
    })).toBe("Not Started");
  });

  it("does not treat agreement acceptance alone as complete", () => {
    expect(resolveAdminOnboardingStage({
      storedStatus: "terms_accepted",
      portalActive: true,
      commercialState: "agreement_accepted",
    })).toBe("In Progress");
  });

  it("requires completed billing and activated portal access", () => {
    expect(resolveAdminOnboardingStage({
      storedStatus: "payment_complete",
      portalActive: false,
      commercialState: "active",
    })).toBe("In Progress");
    expect(resolveAdminOnboardingStage({
      storedStatus: "payment_complete",
      portalActive: true,
      commercialState: "active",
    })).toBe("Complete");
  });
});
