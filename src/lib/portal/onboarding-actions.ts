export type OnboardingAction =
  | "confirm_company"
  | "review_offer"
  | "accept_terms"
  | "complete_checkout"
  | "none";

export function onboardingActionLabel(action: OnboardingAction): string {
  switch (action) {
    case "confirm_company":
      return "Confirm company information";
    case "review_offer":
      return "Review your proposal";
    case "accept_terms":
      return "Accept terms of service";
    case "complete_checkout":
      return "Complete checkout";
    default:
      return "";
  }
}

export function onboardingActionHref(action: OnboardingAction): string | null {
  switch (action) {
    case "confirm_company":
      return "/offer#company";
    case "review_offer":
    case "accept_terms":
    case "complete_checkout":
      return "/offer";
    default:
      return null;
  }
}
