"use client";

import Link from "next/link";
import type { ClientPipelineRecord, PipelineStatus } from "@/lib/pipeline/types";
import { formatDate, formatMoney } from "@/lib/utils";
import { PipelineRowActions } from "./pipeline-row-actions";
import { PipelineStatusSelect } from "./pipeline-status-select";
import { PipelineTagBadges } from "./pipeline-tag-badges";

function truncateText(value: string | null, max = 80) {
  if (!value) return "—";
  if (value.length <= max) return value;
  return `${value.slice(0, max).trim()}…`;
}

function formatMonthlyValue(cents: number | null) {
  if (cents == null) return "—";
  return `${formatMoney(cents)}/mo`;
}

export function PipelineTable({
  clients,
  sortKey,
  sortDirection,
  onSort,
  onStatusChange,
  statusUpdatingId,
  onEdit,
  onDelete,
}: {
  clients: ClientPipelineRecord[];
  sortKey: "business_name" | "status" | "updated_at" | "next_follow_up_date";
  sortDirection: "asc" | "desc";
  onSort: (
    key: "business_name" | "status" | "updated_at" | "next_follow_up_date",
  ) => void;
  onStatusChange: (id: string, status: PipelineStatus) => void;
  statusUpdatingId: string | null;
  onEdit: (client: ClientPipelineRecord) => void;
  onDelete: (client: ClientPipelineRecord) => void;
}) {
  function sortIndicator(key: typeof sortKey) {
    if (sortKey !== key) return null;
    return sortDirection === "asc" ? " ↑" : " ↓";
  }

  return (
    <div className="hidden lg:block">
      <table className="w-full table-fixed text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs tracking-wide text-muted uppercase">
            <th className="w-[16%] pb-3 font-medium">
              <button type="button" onClick={() => onSort("business_name")} className="hover:text-foreground">
                Business{sortIndicator("business_name")}
              </button>
            </th>
            <th className="w-[14%] pb-3 font-medium">Contact</th>
            <th className="w-[11%] pb-3 font-medium">
              <button type="button" onClick={() => onSort("status")} className="hover:text-foreground">
                Status{sortIndicator("status")}
              </button>
            </th>
            <th className="w-[10%] pb-3 font-medium">Tags</th>
            <th className="w-[8%] pb-3 font-medium">Est. Value</th>
            <th className="w-[9%] pb-3 font-medium">
              <button type="button" onClick={() => onSort("next_follow_up_date")} className="hover:text-foreground">
                Follow-up{sortIndicator("next_follow_up_date")}
              </button>
            </th>
            <th className="w-[22%] pb-3 font-medium">Last Conversation</th>
            <th className="w-[8%] pb-3 font-medium">
              <button type="button" onClick={() => onSort("updated_at")} className="hover:text-foreground">
                Updated{sortIndicator("updated_at")}
              </button>
            </th>
            <th className="w-[8%] pb-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr
              key={client.id}
              className="border-b border-border last:border-0 hover:bg-background/60"
            >
              <td className="py-3 pr-3 align-top">
                <Link
                  href={`/admin/pipeline/${client.id}`}
                  className="font-medium break-words underline-offset-2 hover:underline"
                >
                  {client.business_name}
                </Link>
                {client.website_url ? (
                  <p className="mt-1 text-xs break-all text-muted">
                    <a
                      href={client.website_url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-foreground"
                    >
                      {client.website_url.replace(/^https?:\/\//, "")}
                    </a>
                  </p>
                ) : null}
              </td>
              <td className="py-3 pr-3 align-top">
                <p className="break-words">{client.contact_name}</p>
                {client.contact_email ? (
                  <p className="text-xs break-all text-muted">{client.contact_email}</p>
                ) : null}
                {client.phone ? (
                  <p className="text-xs text-muted">{client.phone}</p>
                ) : null}
              </td>
              <td className="py-3 pr-3 align-top">
                <PipelineStatusSelect
                  compact
                  value={client.status}
                  disabled={statusUpdatingId === client.id}
                  onChange={(status) => onStatusChange(client.id, status)}
                  className="max-w-full"
                />
              </td>
              <td className="py-3 pr-3 align-top">
                <PipelineTagBadges tags={client.tags} />
              </td>
              <td className="py-3 pr-3 align-top text-muted">
                {formatMonthlyValue(client.estimated_monthly_value_cents)}
              </td>
              <td className="py-3 pr-3 align-top text-xs text-muted">
                {formatDate(client.next_follow_up_date)}
              </td>
              <td className="py-3 pr-3 align-top">
                <p className="line-clamp-3 break-words text-muted">
                  {truncateText(client.last_conversation, 160)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Last contacted: {formatDate(client.last_contacted_at)}
                </p>
              </td>
              <td className="py-3 pr-3 align-top text-xs text-muted">
                {formatDate(client.updated_at)}
              </td>
              <td className="py-3 align-top">
                <PipelineRowActions
                  client={client}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
