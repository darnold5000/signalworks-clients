import { ManageBillingButton } from "@/components/manage-billing-button";
import { StartCheckoutButton } from "@/components/start-checkout-button";
import { MetaRow, PageHeader, Panel, StatusPill } from "@/components/ui";
import { getPrimaryClient } from "@/lib/data";
import { PLANS } from "@/lib/plans";
import { formatDate, formatMoney } from "@/lib/utils";
import { redirect } from "next/navigation";

export default async function BillingPage() {
  const client = await getPrimaryClient();
  if (!client) redirect("/login");

  const hasSubscription =
    !client.stripe_subscription_id?.includes("_demo_") &&
    (client.subscription_status === "active" ||
      client.subscription_status === "trialing" ||
      Boolean(client.stripe_subscription_id));

  return (
    <>
      <PageHeader
        title="Billing"
        description="Summary from your Signal Works plan. Payment methods and invoices are managed securely in Stripe."
        actions={
          hasSubscription ? (
            <ManageBillingButton clientId={client.id} />
          ) : undefined
        }
      />

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
            Use <strong>Manage Billing</strong> to update your card, download
            invoices, change billing info, or cancel when permitted. Stripe
            handles all payment details — we never store your card.
          </p>
        ) : (
          <p className="mt-6 text-sm text-muted">
            No active Stripe subscription linked yet. Start one below to open
            Stripe Checkout (test mode).
          </p>
        )}
      </Panel>

      {!hasSubscription ? (
        <Panel title="Start a subscription" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {PLANS.map((plan) => (
              <div
                key={plan.key}
                className="rounded-lg border border-border p-4"
              >
                <p className="font-medium">{plan.name}</p>
                <p className="mt-1 text-sm text-muted">{plan.description}</p>
                <p className="mt-3 text-sm font-medium">
                  {formatMoney(plan.monthlyPriceCents)}/month
                </p>
                <div className="mt-4">
                  <StartCheckoutButton
                    clientId={client.id}
                    planKey={plan.key}
                    planName={plan.name}
                    monthlyPriceCents={plan.monthlyPriceCents}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </>
  );
}
