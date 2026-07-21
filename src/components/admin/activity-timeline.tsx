import type { TenantActivityLogEntry } from "@/lib/database/phase1-types";
import { Panel } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export function ActivityTimeline({
  entries,
}: {
  entries: TenantActivityLogEntry[];
}) {
  if (entries.length === 0) {
    return (
      <Panel title="Activity">
        <p className="text-sm text-muted">No activity recorded yet.</p>
      </Panel>
    );
  }

  return (
    <Panel title="Activity">
      <ul className="space-y-4">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="border-b border-border pb-4 last:border-0 last:pb-0"
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium">{entry.summary}</p>
                <p className="text-xs text-muted">
                  {entry.action}
                  {entry.entity_type ? ` · ${entry.entity_type}` : ""}
                </p>
              </div>
              <p className="text-xs text-muted">{formatDateTime(entry.created_at)}</p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
