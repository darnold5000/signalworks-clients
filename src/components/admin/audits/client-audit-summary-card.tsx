import Link from "next/link";
import { ButtonLink, MetaRow, Panel } from "@/components/ui";
import { formatScoreChange } from "@/lib/audit/admin/labels";
import type { ClientAuditSummary } from "@/lib/audit/admin/types";
import { formatDateTime } from "@/lib/utils";

export function ClientAuditSummaryCard({
  tenantId,
  websiteUrl,
  summary,
}: {
  tenantId: string;
  websiteUrl: string | null;
  summary: ClientAuditSummary;
}) {
  const newAuditHref = `/admin/audits/new?tenantId=${tenantId}${
    websiteUrl ? `&url=${encodeURIComponent(websiteUrl)}` : ""
  }`;

  return (
    <Panel title="Audits">
      <dl>
        <MetaRow
          label="Latest score"
          value={summary.latestScore ?? "No audits yet"}
        />
        <MetaRow
          label="Change from previous"
          value={formatScoreChange(summary.scoreChange)}
        />
        <MetaRow
          label="Last run"
          value={summary.lastRunAt ? formatDateTime(summary.lastRunAt) : "—"}
        />
      </dl>

      {summary.highPriorityRecommendations.length > 0 ? (
        <div className="mt-4">
          <p className="text-sm font-medium">High-priority recommendations</p>
          <ul className="mt-2 space-y-1 text-sm">
            {summary.highPriorityRecommendations.map((rec) => (
              <li key={rec.id} className="text-muted">
                {rec.title}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">No open high-priority recommendations.</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <ButtonLink href={newAuditHref}>Run audit</ButtonLink>
        <Link
          href={`/admin/clients/${tenantId}/audits`}
          className="inline-flex items-center rounded-md border border-border px-4 py-2.5 text-sm"
        >
          View history
        </Link>
        {summary.latestRunId ? (
          <Link
            href={`/admin/audits/${summary.latestRunId}`}
            className="inline-flex items-center rounded-md border border-border px-4 py-2.5 text-sm"
          >
            Latest detail
          </Link>
        ) : null}
      </div>
    </Panel>
  );
}
