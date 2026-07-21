import type {
  TenantInternalStatus,
  TenantOnboardingStatus,
} from "@/lib/database/phase1-types";

export const INTERNAL_STATUS_LABELS: Record<TenantInternalStatus, string> = {
  prospect: "Prospect",
  invited: "Invited",
  onboarding: "Onboarding",
  awaiting_agreement: "Awaiting agreement",
  awaiting_payment: "Awaiting payment",
  active: "Active customer",
  past_due: "Past due",
  paused: "Paused",
  canceled: "Canceled",
  archived: "Archived",
};

export const ONBOARDING_STATUS_LABELS: Record<TenantOnboardingStatus, string> = {
  invited: "Invited",
  account_created: "Account created",
  company_information_confirmed: "Company info confirmed",
  offer_viewed: "Offer viewed",
  terms_accepted: "Terms accepted",
  checkout_started: "Checkout started",
  payment_complete: "Payment complete",
  onboarding_complete: "Onboarding complete",
};

export function internalStatusTone(
  status: TenantInternalStatus | null | undefined,
): "neutral" | "success" | "warning" | "danger" {
  switch (status) {
    case "active":
      return "success";
    case "past_due":
    case "canceled":
      return "danger";
    case "prospect":
    case "archived":
      return "neutral";
    default:
      return "warning";
  }
}
