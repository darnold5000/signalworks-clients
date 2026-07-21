import { RequestForm } from "@/components/request-form";
import {
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/ui";
import { getPrimaryClient, getRequestsForClient } from "@/lib/data";
import {
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
} from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { notFound } from "next/navigation";

function statusTone(status: string) {
  if (status === "completed") return "success" as const;
  if (status === "waiting_on_client") return "warning" as const;
  if (status === "canceled") return "danger" as const;
  return "neutral" as const;
}

export default async function RequestsPage() {
  const client = await getPrimaryClient();
  if (!client) notFound();
  const requests = await getRequestsForClient(client.id);

  return (
    <>
      <PageHeader
        title="Requests"
        description="Tell us what to change. We’ll update status as work moves."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Request an update">
          <RequestForm clientId={client.id} />
        </Panel>

        <Panel title="Request history">
          {requests.length === 0 ? (
            <p className="text-sm text-muted">No requests yet.</p>
          ) : (
            <ul className="space-y-4">
              {requests.map((r) => (
                <li
                  key={r.id}
                  className="border-b border-border pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{r.title}</p>
                      <p className="mt-1 text-xs text-muted">
                        {REQUEST_TYPE_LABELS[r.request_type]} ·{" "}
                        {formatDateTime(r.created_at)}
                      </p>
                    </div>
                    <StatusPill
                      label={REQUEST_STATUS_LABELS[r.status]}
                      tone={statusTone(r.status)}
                    />
                  </div>
                  <p className="mt-2 text-sm text-muted">{r.description}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
