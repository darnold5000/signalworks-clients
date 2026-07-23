import type { TenantOnboardingStatus, TenantProfile } from "@/lib/database/phase1-types";
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
  termsAccepted: boolean;
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

  let termsAccepted = false;
  if (activeOffer?.terms_document_id) {
    const { data: acceptance } = await supabase
      .from(TABLES.agreementAcceptances)
      .select("id")
      .eq("tenant_id", client.id)
      .eq("offer_id", activeOffer.id)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    termsAccepted = Boolean(acceptance);
  } else if (activeOffer && !activeOffer.requires_terms_acceptance) {
    termsAccepted = true;
  } else if (
    activeOffer?.requires_terms_acceptance &&
    !activeOffer.terms_document_id
  ) {
    // Invite offers should attach a document; don't block checkout if missing.
    termsAccepted = true;
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
      activeOffer?.requires_terms_acceptance &&
      !termsAccepted &&
      ["offer_viewed", "company_information_confirmed"].includes(
        onboardingStatus,
      )
    ) {
      nextAction = "accept_terms";
    } else if (
      activeOffer &&
      (termsAccepted || !activeOffer.requires_terms_acceptance) &&
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
    termsAccepted,
  };
}
