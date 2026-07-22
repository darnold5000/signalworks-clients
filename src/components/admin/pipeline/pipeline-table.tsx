"use client";

import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui";
import type { ClientPipelineRecord, PipelineStatus } from "@/lib/pipeline/types";
import { formatDate } from "@/lib/utils";
import { PipelineStatusBadge } from "./pipeline-status-badge";
import { PipelineStatusSelect } from "./pipeline-status-select";

function truncateText(value: string | null, max = 80) {
  if (!value) return "—";
  if (value.length <= max) return value;
  return `${value.slice(0, max).trim()}…`;
}

export function PipelineTable({
  clients,
  sortKey,
  sortDirection,
  onSort,
  onStatusChange,
  statusUpdatingId,
  onEdit,
}: {
  clients: ClientPipelineRecord[];
  sortKey: "business_name" | "status" | "updated_at";
  sortDirection: "asc" | "desc";
  onSort: (key: "business_name" | "status" | "updated_at") => void;
  onStatusChange: (id: string, status: PipelineStatus) => void;
  statusUpdatingId: string | null;
  onEdit: (client: ClientPipelineRecord) => void;
}) {
  function sortIndicator(key: typeof sortKey) {
    if (sortKey !== key) return null;
    return sortDirection === "asc" ? " ↑" : " ↓";
  }

  return (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs tracking-wide text-muted uppercase">
            <th className="pb-3 font-medium">
              <button type="button" onClick={() => onSort("business_name")} className="hover:text-foreground">
                Business{sortIndicator("business_name")}
              </button>
            </th>
            <th className="pb-3 font-medium">Contact</th>
            <th className="pb-3 font-medium">
              <button type="button" onClick={() => onSort("status")} className="hover:text-foreground">
                Status{sortIndicator("status")}
              </button>
            </th>
            <th className="pb-3 font-medium">Last Conversation</th>
            <th className="pb-3 font-medium">Plan</th>
            <th className="pb-3 font-medium">
              <button type="button" onClick={() => onSort("updated_at")} className="hover:text-foreground">
                Updated{sortIndicator("updated_at")}
              </button>
            </th>
            <th className="pb-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr
              key={client.id}
              className="border-b border-border last:border-0 hover:bg-background/60"
            >
              <td className="py-3 pr-4">
                <Link
                  href={`/admin/pipeline/${client.id}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {client.business_name}
                </Link>
              </td>
              <td className="py-3 pr-4">{client.contact_name}</td>
              <td className="py-3 pr-4">
                <div className="flex flex-col gap-1.5">
                  <PipelineStatusBadge status={client.status} />
                  <PipelineStatusSelect
                    compact
                    value={client.status}
                    disabled={statusUpdatingId === client.id}
                    onChange={(status) => onStatusChange(client.id, status)}
                  />
                </div>
              </td>
              <td className="max-w-xs py-3 pr-4">
                <p className="line-clamp-2 text-muted">
                  {truncateText(client.last_conversation)}
                </p>
              </td>
              <td className="max-w-xs py-3 pr-4">
                <p className="line-clamp-2 text-muted">{truncateText(client.plan)}</p>
              </td>
              <td className="py-3 pr-4 text-xs text-muted">
                {formatDate(client.updated_at)}
              </td>
              <td className="py-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                    onClick={() => onEdit(client)}
                  >
                    Edit
                  </Button>
                  <ButtonLink
                    href={`/admin/pipeline/${client.id}`}
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                  >
                    View
                  </ButtonLink>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
