import { ManageBillingButton } from "@/components/manage-billing-button";
import { OfferCheckoutButton } from "@/components/offer-checkout-button";
import { StartCheckoutButton } from "@/components/start-checkout-button";
import { MetaRow, PageHeader, Panel, StatusPill } from "@/components/ui";
import { getCurrentProfile } from "@/lib/auth";
import { getPrimaryClient } from "@/lib/data";
import { getActiveOfferForTenant } from "@/lib/offers/queries";
import { calculateAmountDueFirstCycle } from "@/lib/offers/calculate-totals";
import {
  clientCanUseBillingPortal,
  clientHasActiveSubscription,
  clientNeedsOfferCheckout,
} from "@/lib/portal/billing-access";
import { getOnboardingState } from "@/lib/portal/onboarding-state";
import { resolvePlanForClient } from "@/lib/plans";
import { listPurchasesForTenant } from "@/lib/purchases/service";
import { siteConfig } from "@/lib/site";
import { formatDate, formatMoney } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function BillingPage() {
  const profile = await getCurrentProfile();
  const client = await getPrimaryClient();
  if (!client || !profile) notFound();

  const hasSubscription = clientHasActiveSubscription(client);
  const canManageBilling = clientCanUseBillingPortal(client);
  const onboarding = await getOnboardingState(client, profile.id);
  const needsOfferCheckout = clientNeedsOfferCheckout(client, onboarding);
  const activeOffer = needsOfferCheckout
    ? await getActiveOfferForTenant(client.id)
    : null;

  const assignedPlan = resolvePlanForClient({
    plan_name: client.plan_name,
    stripe_price_id: client.stripe_price_id,
  });
  const purchases = await listPurchasesForTenant(client.id);

  return (
    <>
      <PageHeader
        title="Billing"
        description="Your plan summary and secure payment setup through Stripe."
        actions={
          canManageBilling ? (
            <ManageBillingButton clientId={client.id} />
          ) : undefined
        }
      />

      {needsOfferCheckout && activeOffer ? (
        <Panel title="Finish setting up billing" className="mb-6 border-amber-200 bg-amber-50/40">
          <p className="text-sm text-muted">
            You&apos;re almost done. Review your proposal if you need to, then
            continue to Stripe to add a payment method for your plan.
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Proposal</dt>
              <dd className="font-medium">{activeOffer.title}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Due at first billing cycle</dt>
              <dd className="font-medium">
                {formatMoney(
                  calculateAmountDueFirstCycle({
                    subtotal_cents: activeOffer.subtotal_cents,
                    discount_total_cents: activeOffer.discount_total_cents,
                    initial_total_cents: activeOffer.initial_total_cents,
                    recurring_total_cents: activeOffer.recurring_total_cents,
                  }),
                  activeOffer.currency,
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Monthly recurring</dt>
              <dd className="font-medium">
                {formatMoney(
                  activeOffer.recurring_total_cents,
                  activeOffer.currency,
                )}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-3">
            {onboarding.nextAction === "complete_checkout" ? (
              <OfferCheckoutButton label="Continue to Stripe checkout" />
            ) : (
              <a
                href="/offer"
                className="inline-flex rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
              >
                Review proposal
              </a>
            )}
          </div>
        </Panel>
      ) : null}

      <Panel title="Current plan">
        <dl>
          <MetaRow label="Plan" value={client.plan_name} />
          <MetaRow
            label="Monthly price"
            value={formatMoney(client.monthly_price_cents, client.currency)}
          />
          <MetaRow
            label="Next payment"
            value={formatDate(client.current_period_end)}
          />
          <MetaRow
            label="Payment status"
            value={
              <StatusPill
                label={client.subscription_status.replace("_", " ")}
                tone={
                  client.subscription_status === "active"
                    ? "success"
                    : client.subscription_status === "past_due"
                      ? "danger"
                      : "warning"
                }
              />
            }
          />
        </dl>
        {hasSubscription ? (
          <p className="mt-6 text-sm text-muted">
            Use <strong>Manage billing</strong> to update your card, download
            invoices, or change billing details. Stripe handles payment details —
            we never store your card.
          </p>
        ) : (
          <p className="mt-6 text-sm text-muted">
            Your plan is set by Signal Works. When you&apos;re ready, complete
            checkout from your proposal — or email{" "}
            <a
              className="underline underline-offset-2"
              href={`mailto:${client.support_email ?? siteConfig.supportEmail}`}
            >
              {client.support_email ?? siteConfig.supportEmail}
            </a>{" "}
            if you have questions.
          </p>
        )}
      </Panel>

      {!hasSubscription && !needsOfferCheckout && assignedPlan ? (
        <Panel title="Start billing" className="mt-6">
          <div className="rounded-lg border border-border p-4">
            <p className="font-medium">{assignedPlan.name}</p>
            <p className="mt-1 text-sm text-muted">{assignedPlan.description}</p>
            <p className="mt-3 text-sm font-medium">
              {formatMoney(assignedPlan.monthlyPriceCents)}/month
            </p>
            <div className="mt-4">
              <StartCheckoutButton
                clientId={client.id}
                planKey={assignedPlan.key}
                planName={assignedPlan.name}
                monthlyPriceCents={assignedPlan.monthlyPriceCents}
              />
            </div>
          </div>
        </Panel>
      ) : null}

      {!hasSubscription && !needsOfferCheckout && !assignedPlan ? (
        <Panel title="Billing not ready" className="mt-6">
          <p className="text-sm text-muted">
            No plan is assigned to this account yet. Signal Works will publish
            your proposal when billing is ready.
          </p>
        </Panel>
      ) : null}

      {purchases.length > 0 ? (
        <Panel title="Purchases" className="mt-6">
          <ul className="divide-y divide-border">
            {purchases.map((purchase) => (
              <li
                key={purchase.id}
                className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {formatMoney(
                      purchase.amount_due_today_cents,
                      purchase.currency,
                    )}{" "}
                    purchase
                  </p>
                  <p className="text-xs text-muted">
                    {formatDate(purchase.created_at)} · {purchase.status}
                  </p>
                </div>
                <a
                  href={`/purchases/${purchase.id}`}
                  className="text-sm font-medium underline underline-offset-2"
                >
                  View details
                </a>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </>
  );
}
