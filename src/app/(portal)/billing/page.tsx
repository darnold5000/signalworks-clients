import { ManageBillingButton } from "@/components/manage-billing-button";
import { BillingServiceRestartPanel } from "@/components/portal/billing-service-restart-panel";
import { OfferCheckoutButton } from "@/components/offer-checkout-button";
import { OfferPricingSummaryView } from "@/components/portal/offer-pricing-summary";
import { StartCheckoutButton } from "@/components/start-checkout-button";
import { MetaRow, PageHeader, Panel, StatusPill } from "@/components/ui";
import { getCurrentProfile } from "@/lib/auth";
import { getPrimaryClient } from "@/lib/data";
import { getActiveOfferForTenant } from "@/lib/offers/queries";
import { buildOfferPricingSummary } from "@/lib/offers/pricing-summary";
import {
  clientCanUseBillingPortal,
  clientChurnedFromPaidSubscription,
  clientHasHealthySubscription,
  clientHasOngoingSubscription,
  clientNeedsOfferCheckout,
  clientNeedsPaymentAttention,
  clientSubscriptionCancelingAtPeriodEnd,
  subscriptionStatusTone,
} from "@/lib/portal/billing-access";
import { getOnboardingState } from "@/lib/portal/onboarding-state";
import {
  onboardingActionButtonLabel,
  onboardingActionHref,
} from "@/lib/portal/onboarding-actions";
import { resolveCommercialPricing } from "@/lib/portal/resolve-commercial-pricing";
import { resolvePlanForClient } from "@/lib/plans";
import { listPurchasesForTenant } from "@/lib/purchases/service";
import { siteConfig } from "@/lib/site";
import { formatDate, formatMoney } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

function purchaseDescription(status: string): string {
  if (status === "active") return "Subscription setup";
  if (status === "paid") return "Payment";
  if (status === "checkout_created") return "Checkout in progress";
  return "Billing record";
}

export default async function BillingPage() {
  const profile = await getCurrentProfile();
  const client = await getPrimaryClient();
  if (!client || !profile) notFound();

  const hasHealthySubscription = clientHasHealthySubscription(client);
  const hasOngoingSubscription = clientHasOngoingSubscription(client);
  const needsPaymentAttention = clientNeedsPaymentAttention(client);
  const canManageBilling = clientCanUseBillingPortal(client);
  const onboarding = await getOnboardingState(client, profile.id);
  const needsOfferCheckout = clientNeedsOfferCheckout(client, onboarding);
  const activeOffer = await getActiveOfferForTenant(client.id);
  const commercialPricing = await resolveCommercialPricing(client);
  const purchases = await listPurchasesForTenant(client.id);

  const offerPricing =
    activeOffer?.items?.length
      ? buildOfferPricingSummary(activeOffer.items, activeOffer.currency)
      : null;

  const churned = clientChurnedFromPaidSubscription(client);
  const cancelingAtPeriodEnd = clientSubscriptionCancelingAtPeriodEnd(client);
  const supportEmail = client.support_email ?? siteConfig.supportEmail;
  const setupHref = onboarding.nextAction
    ? onboardingActionHref(onboarding.nextAction)
    : null;

  return (
    <>
      <PageHeader
        title="Billing"
        description={
          hasOngoingSubscription
            ? "Your plan, payments, and billing history."
            : "Review pricing and complete secure payment setup through Stripe."
        }
        actions={
          canManageBilling ? (
            <ManageBillingButton clientId={client.id} />
          ) : undefined
        }
      />

      {churned ? (
        <BillingServiceRestartPanel supportEmail={supportEmail} periodEnd={null} />
      ) : null}

      {cancelingAtPeriodEnd ? (
        <BillingServiceRestartPanel
          supportEmail={supportEmail}
          periodEnd={client.current_period_end}
          cancelingAtPeriodEnd
        />
      ) : null}

      {needsPaymentAttention ? (
        <Panel
          title="Payment attention needed"
          className="mb-6 border-red-200 bg-red-50/40"
        >
          <p className="text-sm text-muted">
            Your subscription status is{" "}
            <strong>{client.subscription_status.replace("_", " ")}</strong>.
            Update your payment method in Stripe to avoid interruption.
          </p>
          {canManageBilling ? (
            <div className="mt-4">
              <ManageBillingButton clientId={client.id} />
            </div>
          ) : null}
        </Panel>
      ) : null}

      {needsOfferCheckout && (offerPricing || activeOffer) ? (
        <Panel title="Complete payment setup" className="mb-6 border-amber-200 bg-amber-50/40">
          <p className="text-sm text-muted">
            {onboarding.nextAction === "complete_checkout"
              ? "Your agreement is accepted. Continue to Stripe to add a payment method."
              : "Review your service proposal and agreement, then complete checkout."}
          </p>
          {offerPricing ? (
            <div className="mt-4">
              <p className="text-sm font-medium">{offerPricing.planName}</p>
              <OfferPricingSummaryView summary={offerPricing} compact />
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            {onboarding.nextAction === "complete_checkout" ? (
              <OfferCheckoutButton label="Continue to secure checkout" />
            ) : setupHref ? (
              <Link
                href={setupHref}
                className="inline-flex rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
              >
                {onboardingActionButtonLabel(onboarding.nextAction)}
              </Link>
            ) : null}
            <Link
              href="/offer"
              className="inline-flex rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-background"
            >
              View pricing &amp; agreement
            </Link>
          </div>
        </Panel>
      ) : null}

      <Panel title={hasOngoingSubscription ? "Current plan" : "Plan summary"}>
        <dl>
          <MetaRow label="Plan" value={commercialPricing?.planName ?? client.plan_name} />
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
                      ? `${formatMoney(commercialPricing.recurringDiscountAmountCents, commercialPricing.currency)}/month for ${commercialPricing.discountDurationMonths} months`
                      : `${formatMoney(commercialPricing.recurringDiscountAmountCents, commercialPricing.currency)}/month`
                  }
                />
              ) : null}
              {commercialPricing.recurringDiscountAmountCents > 0 &&
              commercialPricing.discountDurationMonths ? (
                <MetaRow
                  label="Standard rate afterward"
                  value={`${formatMoney(
                    commercialPricing.standardMonthlyAmountAfterDiscountCents,
                    commercialPricing.currency,
                  )}/month`}
                />
              ) : commercialPricing.recurringDiscountAmountCents === 0 ? (
                <MetaRow
                  label="Standard monthly price"
                  value={formatMoney(
                    commercialPricing.standardMonthlyAmountAfterDiscountCents,
                    commercialPricing.currency,
                  )}
                />
              ) : null}
            </>
          ) : (
            <MetaRow
              label="Monthly price"
              value={formatMoney(client.monthly_price_cents, client.currency)}
            />
          )}
          <MetaRow
            label="Next payment"
            value={formatDate(client.current_period_end)}
          />
          <MetaRow
            label="Subscription status"
            value={
              <StatusPill
                label={client.subscription_status.replace("_", " ")}
                tone={subscriptionStatusTone(client.subscription_status)}
              />
            }
          />
        </dl>
        {hasHealthySubscription ? (
          <p className="mt-6 text-sm text-muted">
            Use <strong>Manage billing</strong> to update your card, download
            invoices, or change billing details. Stripe handles payment details —
            Signal Works never stores your card.
          </p>
        ) : !needsOfferCheckout ? (
          <p className="mt-6 text-sm text-muted">
            Questions about billing? Email{" "}
            <a
              className="underline underline-offset-2"
              href={`mailto:${client.support_email ?? siteConfig.supportEmail}`}
            >
              {client.support_email ?? siteConfig.supportEmail}
            </a>
            .
          </p>
        ) : null}
      </Panel>

      {!hasOngoingSubscription && !needsOfferCheckout && resolvePlanForClient({
        plan_name: client.plan_name,
        stripe_price_id: client.stripe_price_id,
      }) ? (
        <Panel title="Start billing" className="mt-6">
          <div className="rounded-lg border border-border p-4">
            <p className="font-medium">{client.plan_name}</p>
            <p className="mt-3 text-sm font-medium">
              {formatMoney(client.monthly_price_cents, client.currency)}/month
            </p>
            <div className="mt-4">
              <StartCheckoutButton
                clientId={client.id}
                planKey={
                  resolvePlanForClient({
                    plan_name: client.plan_name,
                    stripe_price_id: client.stripe_price_id,
                  })!.key
                }
                planName={client.plan_name}
                monthlyPriceCents={client.monthly_price_cents}
              />
            </div>
          </div>
        </Panel>
      ) : null}

      {purchases.length > 0 ? (
        <Panel title="Billing history" className="mt-6">
          <ul className="divide-y divide-border">
            {purchases.map((purchase) => (
              <li
                key={purchase.id}
                className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {purchaseDescription(purchase.status)} ·{" "}
                    {formatMoney(
                      purchase.amount_due_today_cents,
                      purchase.currency,
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDate(purchase.created_at)} · {purchase.status}
                  </p>
                </div>
                <Link
                  href={`/purchases/${purchase.id}`}
                  className="text-sm font-medium underline underline-offset-2"
                >
                  View details
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </>
  );
}
