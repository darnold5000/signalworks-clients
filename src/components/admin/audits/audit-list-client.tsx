"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useTransition } from "react";
import { ButtonLink, PageHeader, Panel, StatusPill } from "@/components/ui";
import {
  AUDIT_STATUS_LABELS,
  AUDIT_TYPE_LABELS,
  auditStatusTone,
  formatScoreChange,
} from "@/lib/audit/admin/labels";
import type { AuditListItem } from "@/lib/audit/admin/types";
import { formatDateTime } from "@/lib/utils";

type TenantOption = { id: string; name: string };

export function AuditListClient({
  items,
  tenants,
  embedded = false,
}: {
  items: AuditListItem[];
  tenants: TenantOption[];
  embedded?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const filters = useMemo(
    () => ({
      tenantId: searchParams.get("tenantId") ?? "",
      auditType: searchParams.get("auditType") ?? "",
      status: searchParams.get("status") ?? "",
      needsAttention: searchParams.get("needsAttention") === "1",
      minScore: searchParams.get("minScore") ?? "",
      maxScore: searchParams.get("maxScore") ?? "",
      dateFrom: searchParams.get("dateFrom") ?? "",
      dateTo: searchParams.get("dateTo") ?? "",
    }),
    [searchParams],
  );

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.replace(`/admin/audits?${params.toString()}`);
    });
  }

  return (
    <div>
      {!embedded ? (
        <PageHeader
          title="Audits"
          description="Website and client health audits run synchronously from the admin console."
          actions={<ButtonLink href="/admin/audits/new">Run audit</ButtonLink>}
        />
      ) : null}

      {!embedded ? (
        <Panel title="Filters" className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Client</span>
            <select
              value={filters.tenantId}
              onChange={(event) => updateFilter("tenantId", event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              disabled={pending}
            >
              <option value="">All clients</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Audit type</span>
            <select
              value={filters.auditType}
              onChange={(event) => updateFilter("auditType", event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              disabled={pending}
            >
              <option value="">All types</option>
              <option value="public">Website audit</option>
              <option value="client_health">Client Health</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Status</span>
            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              disabled={pending}
            >
              <option value="">All statuses</option>
              {Object.entries(AUDIT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-end gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.needsAttention}
              onChange={(event) =>
                updateFilter("needsAttention", event.target.checked ? "1" : "")
              }
              disabled={pending}
            />
            Needs attention
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Min score</span>
            <input
              type="number"
              min={0}
              max={100}
              value={filters.minScore}
              onChange={(event) => updateFilter("minScore", event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              disabled={pending}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Max score</span>
            <input
              type="number"
              min={0}
              max={100}
              value={filters.maxScore}
              onChange={(event) => updateFilter("maxScore", event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              disabled={pending}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Date from</span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => updateFilter("dateFrom", event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              disabled={pending}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Date to</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => updateFilter("dateTo", event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              disabled={pending}
            />
          </label>
        </div>
      </Panel>
      ) : null}

      <Panel title={`${items.length} audit run${items.length === 1 ? "" : "s"}`}>
        {items.length === 0 ? (
          <p className="text-sm text-muted">No audits match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2 pr-4 font-medium">Business / domain</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Client</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Score</th>
                  <th className="py-2 pr-4 font-medium">Change</th>
                  <th className="py-2 pr-4 font-medium">Run date</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.runId} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-medium">
                        {item.businessName ?? item.normalizedDomain}
                      </p>
                      <p className="text-xs text-muted">{item.normalizedDomain}</p>
                    </td>
                    <td className="py-3 pr-4">
                      {AUDIT_TYPE_LABELS[item.auditType] ?? item.auditType}
                    </td>
                    <td className="py-3 pr-4">
                      {item.tenantName ? (
                        <Link
                          href={`/admin/clients/${item.tenantId}/audits`}
                          className="text-accent hover:underline"
                        >
                          {item.tenantName}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusPill
                        label={AUDIT_STATUS_LABELS[item.status] ?? item.status}
                        tone={auditStatusTone(item.status)}
                      />
                      {item.needsAttention ? (
                        <span className="ml-2 text-xs text-warning">Attention</span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 font-medium">
                      {item.overallScore ?? "—"}
                    </td>
                    <td className="py-3 pr-4">
                      {formatScoreChange(item.scoreChange)}
                    </td>
                    <td className="py-3 pr-4 text-muted">
                      {formatDateTime(item.completedAt ?? item.createdAt)}
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/admin/audits/${item.runId}`}
                        className="text-accent hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
