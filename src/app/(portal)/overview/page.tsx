import { ManageBillingButton } from "@/components/manage-billing-button";
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
import { getOnboardingState } from "@/lib/portal/onboarding-state";
import { siteConfig } from "@/lib/site";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";
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
            <ManageBillingButton clientId={client.id} />
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
        <Panel title="Overview">
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
            <MetaRow label="Plan" value={client.plan_name} />
            <MetaRow
              label="Monthly rate"
              value={formatMoney(client.monthly_price_cents, client.currency)}
            />
            <MetaRow
              label="Next billing date"
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
            <MetaRow
              label="SSL"
              value={
                <StatusPill
                  label={client.ssl_status}
                  tone={client.ssl_status === "active" ? "success" : "warning"}
                />
              }
            />
            <MetaRow
              label="Last deployment"
              value={formatDateTime(client.last_deployment_at)}
            />
            <MetaRow
              label="Last backup"
              value={formatDateTime(client.last_backup_at)}
            />
            <MetaRow
              label="Analytics"
              value={client.analytics_summary ?? "—"}
            />
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
