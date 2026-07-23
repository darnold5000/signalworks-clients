export type OnboardingAction =
  | "confirm_company"
  | "review_offer"
  | "accept_terms"
  | "complete_checkout"
  | "none";

export function onboardingActionLabel(action: OnboardingAction): string {
  switch (action) {
    case "confirm_company":
      return "Confirm your company details";
    case "review_offer":
      return "Review your proposal";
    case "accept_terms":
      return "Review and accept your agreement";
    case "complete_checkout":
      return "Set up billing in Stripe";
    default:
      return "";
  }
}

export function onboardingActionButtonLabel(action: OnboardingAction): string {
  switch (action) {
    case "complete_checkout":
      return "Continue to checkout";
    default:
      return "Continue";
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
