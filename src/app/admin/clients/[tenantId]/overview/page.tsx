import { notFound } from "next/navigation";
import {
  BusinessProfilePanel,
  InternalNotesPanel,
} from "@/components/admin/admin-client-header";
import { MetaRow, Panel, StatusPill } from "@/components/ui";
import { getAdminClientBundle } from "@/lib/admin/client-records";
import {
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
} from "@/lib/types";
import { formatDate, formatDateTime, formatMoney, monthlyMarginCents } from "@/lib/utils";

export default async function AdminClientOverviewPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const bundle = await getAdminClientBundle(tenantId);
  if (!bundle) notFound();

  const { client, requests } = bundle;
  const margin = monthlyMarginCents(
    client.monthly_price_cents,
    client.estimated_infra_cost_cents,
  );
  const lastRequest = requests[0];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <BusinessProfilePanel bundle={bundle} />

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
                tone={client.website_status === "live" ? "success" : "warning"}
              />
            }
          />
          <MetaRow label="Plan" value={client.plan_name} />
          <MetaRow
            label="Monthly price"
            value={formatMoney(client.monthly_price_cents, client.currency)}
          />
          <MetaRow label="Monthly margin" value={formatMoney(margin)} />
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

      <InternalNotesPanel bundle={bundle} />

      <Panel title="Service requests" className="lg:col-span-2">
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
    </div>
  );
}
