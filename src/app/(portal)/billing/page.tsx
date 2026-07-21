import { ManageBillingButton } from "@/components/manage-billing-button";
import { StartCheckoutButton } from "@/components/start-checkout-button";
import { MetaRow, PageHeader, Panel, StatusPill } from "@/components/ui";
import { getPrimaryClient } from "@/lib/data";
import { resolvePlanForClient } from "@/lib/plans";
import { siteConfig } from "@/lib/site";
import { formatDate, formatMoney } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function BillingPage() {
  const client = await getPrimaryClient();
  if (!client) notFound();

  const hasSubscription =
    !client.stripe_subscription_id?.includes("_demo_") &&
    (client.subscription_status === "active" ||
      client.subscription_status === "trialing" ||
      Boolean(client.stripe_subscription_id));

  const assignedPlan = resolvePlanForClient({
    plan_name: client.plan_name,
    stripe_price_id: client.stripe_price_id,
  });

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
            Your plan is set by Signal Works. When you&apos;re ready, start
            billing for that plan below — or email{" "}
            <a
              className="underline underline-offset-2"
              href={`mailto:${client.support_email ?? siteConfig.supportEmail}`}
            >
              {client.support_email ?? siteConfig.supportEmail}
            </a>{" "}
            if something looks wrong.
          </p>
        )}
      </Panel>

      {!hasSubscription && assignedPlan ? (
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

      {!hasSubscription && !assignedPlan ? (
        <Panel title="Billing not ready" className="mt-6">
          <p className="text-sm text-muted">
            No plan is assigned to this account yet. Signal Works will set your
            plan and send login details when your site is ready for billing.
          </p>
        </Panel>
      ) : null}
    </>
  );
}
