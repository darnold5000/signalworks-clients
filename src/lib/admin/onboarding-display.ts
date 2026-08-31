import type { CommercialState } from "@/lib/admin/commercial-account-summary";
import type { TenantOnboardingStatus } from "@/lib/database/phase1-types";

export type AdminOnboardingStage = "Not Started" | "In Progress" | "Complete";

/** Client status is deliberately independent from onboarding progress. */
export function resolveAdminOnboardingStage(args: {
  storedStatus: TenantOnboardingStatus | null | undefined;
  portalActive: boolean;
  commercialState: CommercialState;
}): AdminOnboardingStage {
  if (!args.storedStatus || args.storedStatus === "not_started") {
    return "Not Started";
  }

  // The original client-first release wrote this value from client.status alone.
  // With no portal or commercial activity, it is a legacy false-complete marker.
  if (
    args.storedStatus === "onboarding_complete" &&
    !args.portalActive &&
    args.commercialState === "not_established"
  ) {
    return "Not Started";
  }

  const paymentCompleted =
    args.storedStatus === "payment_complete" ||
    args.storedStatus === "onboarding_complete";

  return args.portalActive &&
    args.commercialState === "active" &&
    paymentCompleted
    ? "Complete"
    : "In Progress";
}
