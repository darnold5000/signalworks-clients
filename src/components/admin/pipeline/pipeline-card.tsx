"use client";

import Link from "next/link";
import { Button } from "@/components/ui";
import type { ClientPipelineRecord, PipelineStatus } from "@/lib/pipeline/types";
import { formatDate, formatMoney } from "@/lib/utils";
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
  onStatusChange,
  statusUpdating,
}: {
  client: ClientPipelineRecord;
  onEdit: (client: ClientPipelineRecord) => void;
  onStatusChange: (id: string, status: PipelineStatus) => void;
  statusUpdating?: boolean;
}) {
  return (
    <article className="rounded-xl border border-border bg-surface p-4 lg:hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href={`/admin/pipeline/${client.id}`}
            className="font-medium underline-offset-2 hover:underline"
          >
            {client.business_name}
          </Link>
          <p className="mt-1 text-sm text-muted">{client.contact_name}</p>
          {client.contact_email ? (
            <p className="text-xs text-muted">{client.contact_email}</p>
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
          <p className="text-xs tracking-wide text-muted uppercase">Next Follow-up</p>
          <p className="mt-1 text-muted">{formatDate(client.next_follow_up_date)}</p>
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
          <p className="mt-1 line-clamp-2 text-muted">
            {truncateText(client.last_conversation)}
          </p>
          <p className="mt-1 text-xs text-muted">
            Last contacted: {formatDate(client.last_contacted_at)}
          </p>
        </div>
        <div>
          <p className="text-xs tracking-wide text-muted uppercase">Plan</p>
          <p className="mt-1 line-clamp-2 text-muted">{truncateText(client.plan)}</p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button type="button" variant="secondary" className="flex-1" onClick={() => onEdit(client)}>
          Edit
        </Button>
        <ButtonLink href={`/admin/pipeline/${client.id}`} variant="secondary" className="flex-1">
          View
        </ButtonLink>
      </div>
    </article>
  );
}

function ButtonLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium transition-colors hover:bg-background ${className ?? ""}`}
    >
      {children}
    </Link>
  );
}
