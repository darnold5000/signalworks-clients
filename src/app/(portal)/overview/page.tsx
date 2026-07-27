import { ManageBillingButton } from "@/components/manage-billing-button";
import { OfferCheckoutButton } from "@/components/offer-checkout-button";
import { ActionRequiredCard } from "@/components/portal/action-required-card";
import {
  ButtonLink,
  MetaRow,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/ui";
import { getCurrentProfile } from "@/lib/auth";
import { getPrimaryClient } from "@/lib/data";
import {
  clientCanUseBillingPortal,
  clientHasHealthySubscription,
  clientNeedsOfferCheckout,
  subscriptionStatusTone,
} from "@/lib/portal/billing-access";
import { getOnboardingState } from "@/lib/portal/onboarding-state";
import { resolveCommercialPricing } from "@/lib/portal/resolve-commercial-pricing";
import { siteConfig } from "@/lib/site";
import { formatDate, formatMoney } from "@/lib/utils";
import {
  WebsiteLastUpdateMetaRow,
  WebsiteSecurityMetaRow,
} from "@/components/portal/website-information-rows";
import { notFound } from "next/navigation";

function websiteTone(status: string) {
  if (status === "live") return "success" as const;
  if (status === "building" || status === "staging") return "warning" as const;
  return "danger" as const;
}

export default async function OverviewPage() {
  const profile = await getCurrentProfile();
  const client = await getPrimaryClient();
  if (!client || !profile) notFound();

  const onboarding = await getOnboardingState(client, profile.id);
  const canManageBilling = clientCanUseBillingPortal(client);
  const hasHealthySubscription = clientHasHealthySubscription(client);
  const needsOfferCheckout = clientNeedsOfferCheckout(client, onboarding);
  const commercialPricing = await resolveCommercialPricing(client);

  const updatesLeft = Math.max(
    0,
    client.updates_included_per_month - client.updates_used_this_month,
  );

  return (
    <>
      <PageHeader
        title={client.business_name}
        description="Your website status, plan, and quick actions."
        actions={
          <>
            {client.website_url ? (
              <ButtonLink href={client.website_url} target="_blank">
                View Website
              </ButtonLink>
            ) : null}
            {canManageBilling ? (
              <ManageBillingButton clientId={client.id} />
            ) : needsOfferCheckout &&
              onboarding.nextAction === "complete_checkout" ? (
              <OfferCheckoutButton label="Complete payment setup" />
            ) : needsOfferCheckout ? (
              <ButtonLink href="/offer">Review offer</ButtonLink>
            ) : null}
            <ButtonLink href="/requests" variant="secondary">
              Request an Update
            </ButtonLink>
            <ButtonLink href="/support" variant="ghost">
              Contact Support
            </ButtonLink>
          </>
        }
      />

      <ActionRequiredCard nextAction={onboarding.nextAction} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Current service">
          <dl>
            <MetaRow
              label="Website status"
              value={
                <StatusPill
                  label={client.website_status}
                  tone={websiteTone(client.website_status)}
                />
              }
            />
            <MetaRow
              label="Plan"
              value={commercialPricing?.planName ?? client.plan_name}
            />
            {commercialPricing ? (
              <>
                <MetaRow
                  label="Current monthly rate"
                  value={formatMoney(
                    commercialPricing.discountedMonthlyAmountCents,
                    commercialPricing.currency,
                  )}
                />
                {commercialPricing.recurringDiscountAmountCents > 0 ? (
                  <MetaRow
                    label="Discount"
                    value={
                      commercialPricing.discountDurationMonths
                        ? `${formatMoney(commercialPricing.recurringDiscountAmountCents, commercialPricing.currency)}/month through first ${commercialPricing.discountDurationMonths} billing cycles`
                        : `${formatMoney(commercialPricing.recurringDiscountAmountCents, commercialPricing.currency)}/month`
                    }
                  />
                ) : null}
                {commercialPricing.recurringDiscountAmountCents > 0 &&
                commercialPricing.discountDurationMonths ? (
                  <MetaRow
                    label="Standard rate"
                    value={`${formatMoney(
                      commercialPricing.standardMonthlyAmountAfterDiscountCents,
                      commercialPricing.currency,
                    )}/month afterward`}
                  />
                ) : null}
              </>
            ) : (
              <MetaRow
                label="Monthly rate"
                value={formatMoney(client.monthly_price_cents, client.currency)}
              />
            )}
            <MetaRow
              label="Next billing date"
              value={formatDate(client.current_period_end)}
            />
            <MetaRow
              label="Payment status"
              value={
                <StatusPill
                  label={client.subscription_status.replace("_", " ")}
                  tone={subscriptionStatusTone(client.subscription_status)}
                />
              }
            />
          </dl>
        </Panel>

        <Panel title="Website information">
          <dl>
            <MetaRow label="Domain" value={client.domain ?? "—"} />
            <MetaRow
              label="Hosting status"
              value={
                <StatusPill
                  label={client.hosting_status}
                  tone={
                    client.hosting_status === "active" ? "success" : "warning"
                  }
                />
              }
            />
            <WebsiteLastUpdateMetaRow client={client} />
            <WebsiteSecurityMetaRow client={client} />
            <MetaRow
              label="Updates remaining this month"
              value={`${updatesLeft} of ${client.updates_included_per_month}`}
            />
          </dl>
        </Panel>
      </div>

      <p className="mt-8 text-sm text-muted">
        Need help? Email{" "}
        <a
          className="underline underline-offset-2"
          href={`mailto:${client.support_email ?? siteConfig.supportEmail}`}
        >
          {client.support_email ?? siteConfig.supportEmail}
        </a>
        .
      </p>
    </>
  );
}
