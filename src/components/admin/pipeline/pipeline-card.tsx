"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import type { ClientPipelineRecord, PipelineStatus } from "@/lib/pipeline/types";
import { formatMoney } from "@/lib/utils";
import { InlineLastContactDate } from "./inline-last-contact-date";
import { PipelineRowActions } from "./pipeline-row-actions";
import { PipelineStatusBadge } from "./pipeline-status-badge";
import { PipelineStatusSelect } from "./pipeline-status-select";
import { PipelineTagBadges } from "./pipeline-tag-badges";

function truncateText(value: string | null) {
  if (!value) return "—";
  return value;
}

export function PipelineCard({
  client,
  onEdit,
  onDelete,
  onStatusChange,
  statusUpdating,
  selected,
  onToggleSelected,
  onLastContactChange,
  lastContactUpdating,
}: {
  client: ClientPipelineRecord;
  onEdit: (client: ClientPipelineRecord) => void;
  onDelete: (client: ClientPipelineRecord) => void;
  onStatusChange: (id: string, status: PipelineStatus) => void;
  statusUpdating?: boolean;
  selected: boolean;
  onToggleSelected: (id: string) => void;
  onLastContactChange: (id: string, date: string | null) => void;
  lastContactUpdating?: boolean;
}) {
  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface p-4 lg:hidden">
      <div className="flex items-start justify-between gap-3">
        <input
          type="checkbox"
          aria-label={`Select ${client.business_name || "unnamed prospect"}`}
          checked={selected}
          onChange={() => onToggleSelected(client.id)}
          className="mt-1 size-4 rounded border-border"
        />
        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/pipeline/${client.id}`}
            className="font-medium break-words underline-offset-2 hover:underline"
          >
            {client.business_name || "Unnamed prospect"}
          </Link>
          <p className="mt-1 text-sm break-words text-muted">
            {client.contact_name || "—"}
          </p>
          {client.contact_email ? (
            <p className="text-xs break-all text-muted">{client.contact_email}</p>
          ) : null}
        </div>
        <PipelineStatusBadge status={client.status} />
      </div>

      <div className="mt-3 space-y-2 text-sm">
        <div>
          <p className="text-xs tracking-wide text-muted uppercase">Tags</p>
          <PipelineTagBadges tags={client.tags} className="mt-1" />
        </div>
        <div>
          <p className="text-xs tracking-wide text-muted uppercase">Est. Monthly Value</p>
          <p className="mt-1 text-muted">
            {client.estimated_monthly_value_cents != null
              ? `${formatMoney(client.estimated_monthly_value_cents)}/mo`
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs tracking-wide text-muted uppercase">Last Contact</p>
          <div className="mt-1">
            <InlineLastContactDate
              value={client.last_contacted_at}
              disabled={lastContactUpdating}
              onChange={(date) => onLastContactChange(client.id, date)}
            />
          </div>
        </div>
        <div>
          <p className="text-xs tracking-wide text-muted uppercase">Health Check</p>
          <p className="mt-1 text-muted">
            {client.health_check_sent ? (
              <span className="inline-flex items-center gap-1">
                <Check className="size-3.5" aria-hidden="true" />
                Sent
              </span>
            ) : (
              "—"
            )}
          </p>
        </div>
        <div>
          <p className="text-xs tracking-wide text-muted uppercase">Status</p>
          <PipelineStatusSelect
            value={client.status}
            disabled={statusUpdating}
            onChange={(status) => onStatusChange(client.id, status)}
            className="mt-1"
          />
        </div>
        <div>
          <p className="text-xs tracking-wide text-muted uppercase">Last Conversation</p>
          <p className="mt-1 line-clamp-3 break-words text-muted">
            {truncateText(client.last_conversation)}
          </p>
        </div>
        <div>
          <p className="text-xs tracking-wide text-muted uppercase">Plan</p>
          <p className="mt-1 line-clamp-2 text-muted">{truncateText(client.plan)}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end">
        <PipelineRowActions
          client={client}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </article>
  );
}
