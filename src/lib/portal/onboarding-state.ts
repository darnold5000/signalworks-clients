import type { TenantOnboardingStatus, TenantProfile } from "@/lib/database/phase1-types";
import { hasAcceptedRequiredOfferAgreements } from "@/lib/agreements/service";
import { getActiveOfferForTenant } from "@/lib/offers/queries";
import type { OnboardingAction } from "@/lib/portal/onboarding-actions";
import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";
import type { Client } from "@/lib/types";

export type OnboardingState = {
  profile: TenantProfile | null;
  onboardingStatus: TenantOnboardingStatus | null;
  nextAction: OnboardingAction;
  hasActiveOffer: boolean;
  offerId: string | null;
  /** @deprecated use agreementsAccepted */
  termsAccepted: boolean;
  agreementsAccepted: boolean;
  requiresTerms: boolean;
  requiresSow: boolean;
};

export async function getOnboardingState(
  client: Client,
  userId: string,
): Promise<OnboardingState> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from(TABLES.tenantProfiles)
    .select("*")
    .eq("tenant_id", client.id)
    .maybeSingle();

  const tenantProfile = (profile as TenantProfile | null) ?? null;
  const onboardingStatus = tenantProfile?.onboarding_status ?? "invited";
  const activeOffer = await getActiveOfferForTenant(client.id);

  const requiresTerms = Boolean(
    activeOffer?.requires_terms_acceptance && activeOffer.terms_document_id,
  );
  const requiresSow = Boolean(activeOffer?.sow_document_id);

  let agreementsAccepted = false;
  if (activeOffer) {
    if (requiresTerms || requiresSow) {
      agreementsAccepted = await hasAcceptedRequiredOfferAgreements({
        tenantId: client.id,
        offerId: activeOffer.id,
        userId,
        termsDocumentId: activeOffer.terms_document_id,
        sowDocumentId: activeOffer.sow_document_id,
        requiresTerms: activeOffer.requires_terms_acceptance,
      });
    } else if (!activeOffer.requires_terms_acceptance) {
      agreementsAccepted = true;
    } else if (
      activeOffer.requires_terms_acceptance &&
      !activeOffer.terms_document_id &&
      !activeOffer.sow_document_id
    ) {
      agreementsAccepted = true;
    }
  }

  const hasSubscription =
    client.subscription_status === "active" ||
    client.subscription_status === "trialing";

  let nextAction: OnboardingAction = "none";

  if (!hasSubscription) {
    if (
      !tenantProfile ||
      onboardingStatus === "invited" ||
      onboardingStatus === "account_created"
    ) {
      nextAction = "confirm_company";
    } else if (
      activeOffer &&
      ["company_information_confirmed", "invited", "account_created"].includes(
        onboardingStatus,
      )
    ) {
      nextAction = "review_offer";
    } else if (
      activeOffer &&
      !agreementsAccepted &&
      (requiresTerms || requiresSow) &&
      ["offer_viewed", "company_information_confirmed"].includes(
        onboardingStatus,
      )
    ) {
      nextAction = "accept_terms";
    } else if (
      activeOffer &&
      agreementsAccepted &&
      !["payment_complete", "onboarding_complete"].includes(onboardingStatus)
    ) {
      nextAction = "complete_checkout";
    }
  }

  return {
    profile: tenantProfile,
    onboardingStatus,
    nextAction,
    hasActiveOffer: Boolean(activeOffer),
    offerId: activeOffer?.id ?? null,
    termsAccepted: agreementsAccepted,
    agreementsAccepted,
    requiresTerms,
    requiresSow,
  };
}
