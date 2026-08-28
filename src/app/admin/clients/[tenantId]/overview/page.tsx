import { notFound } from "next/navigation";
import { AdminBusinessProfileForm } from "@/components/admin/admin-business-profile-form";
import { AdminPortalWebsiteForm } from "@/components/admin/admin-portal-website-form";
import { ClientAuditSummaryCard } from "@/components/admin/audits/client-audit-summary-card";
import { DeleteClientPanel } from "@/components/admin/delete-client-panel";
import { InternalNotesPanel } from "@/components/admin/internal-notes-panel";
import { InfrastructureSummaryCard } from "@/components/admin/infrastructure-summary-card";
import { MetaRow, Panel, StatusPill } from "@/components/ui";
import { getAdminClientBundle } from "@/lib/admin/client-records";
import { getPortalInviteDisplay } from "@/lib/admin/portal-invite-status";
import {
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
} from "@/lib/types";
import { getClientAuditSummary } from "@/lib/audit/admin/queries";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";

export default async function AdminClientOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { tenantId } = await params;
  const { edit } = await searchParams;
  const bundle = await getAdminClientBundle(tenantId);
  if (!bundle) notFound();

  const { client, profile, requests, platformCategory, owner, activity, recurringFinancials } =
    bundle;
  const portalInvite = getPortalInviteDisplay({
    profile,
    owner,
    activity,
  });
  const lastRequest = requests[0];
  const auditSummary = await getClientAuditSummary(tenantId);
  const websiteUrl = client.website_url ?? profile?.website_url ?? null;

  return (
    <div className="space-y-6">
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <AdminBusinessProfileForm
            tenantId={tenantId}
            client={client}
            profile={profile}
            portalInvite={portalInvite}
            startEditing={edit === "1"}
          />

          <Panel title="Account summary">
            <dl>
              <MetaRow
                label="Tenant status"
                value={
                  <StatusPill
                    label={client.status}
                    tone={client.status === "active" ? "success" : "warning"}
                  />
                }
              />
              <MetaRow
                label="Website"
                value={
                  <StatusPill
                    label={client.website_status}
                    tone={
                      client.website_status === "live" ? "success" : "warning"
                    }
                  />
                }
              />
              <MetaRow label="Plan" value={client.plan_name} />
              <MetaRow
                label="Base monthly recurring"
                value={formatMoney(recurringFinancials.baseRecurringMrrCents, client.currency)}
              />
              <MetaRow label="Current monthly billing" value={formatMoney(recurringFinancials.effectiveMrrCents, client.currency)} />
              {recurringFinancials.activeRecurringDiscountMrrCents > 0 ? (
                  <MetaRow label="Recurring discount" value={`-${formatMoney(recurringFinancials.activeRecurringDiscountMrrCents, client.currency)}`} />
              ) : null}
              {recurringFinancials.discountKind !== "none" ? (
                <MetaRow
                  label="Discount term"
                  value={recurringFinancials.discountKind === "ongoing"
                    ? "Ongoing"
                    : recurringFinancials.discountEndsAt
                      ? `Ends ${formatDate(recurringFinancials.discountEndsAt)}`
                      : "Temporary"}
                />
              ) : null}
              <MetaRow label="Monthly margin" value={formatMoney(recurringFinancials.effectiveMarginCents)} />
              <MetaRow
                label="Last deployment"
                value={formatDate(client.last_deployment_at)}
              />
              <MetaRow
                label="Last request"
                value={lastRequest?.title ?? "—"}
              />
              <MetaRow
                label="Client since"
                value={formatDate(client.created_at)}
              />
            </dl>
          </Panel>

          <InternalNotesPanel client={client} />
        </div>

        <div className="space-y-6">
          <AdminPortalWebsiteForm client={client} />
          <InfrastructureSummaryCard bundle={bundle} />
          <ClientAuditSummaryCard
            tenantId={tenantId}
            websiteUrl={websiteUrl}
            summary={auditSummary}
          />
        </div>
      </div>

      <Panel title="Service requests">
        {requests.length === 0 ? (
          <p className="text-sm text-muted">No requests.</p>
        ) : (
          <ul className="space-y-3">
            {requests.map((request) => (
              <li
                key={request.id}
                className="flex flex-col gap-1 border-b border-border pb-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{request.title}</p>
                  <p className="text-xs text-muted">
                    {REQUEST_TYPE_LABELS[request.request_type]} ·{" "}
                    {formatDateTime(request.created_at)}
                  </p>
                </div>
                <StatusPill
                  label={REQUEST_STATUS_LABELS[request.status]}
                  tone={
                    request.status === "completed"
                      ? "success"
                      : request.status === "waiting_on_client"
                        ? "warning"
                        : "neutral"
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div
        id="delete-client"
        className="scroll-mt-8 border-t border-border pt-8"
      >
        <DeleteClientPanel
          tenantId={tenantId}
          slug={client.slug}
          displayName={profile?.display_name ?? client.business_name}
          platformCategory={platformCategory}
        />
      </div>
    </div>
  );
}
