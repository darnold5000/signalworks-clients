"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AdminClientListItem } from "@/lib/admin/client-records";
import { INTERNAL_STATUS_LABELS, internalStatusTone } from "@/lib/admin/labels";
import type { TenantInternalStatus } from "@/lib/database/phase1-types";
import { StatusPill } from "@/components/ui";
import { formatDate, formatMoney, monthlyMarginCents } from "@/lib/utils";

type FilterKey =
  | "all"
  | TenantInternalStatus
  | "past_due_billing"
  | "onboarding_tenant";

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "prospect", label: "Prospect" },
  { key: "invited", label: "Invited" },
  { key: "onboarding", label: "Onboarding" },
  { key: "awaiting_agreement", label: "Awaiting acceptance" },
  { key: "awaiting_payment", label: "Awaiting payment" },
  { key: "past_due_billing", label: "Past due" },
  { key: "paused", label: "Paused" },
  { key: "canceled", label: "Canceled" },
  { key: "archived", label: "Archived" },
];

function matchesFilter(client: AdminClientListItem, filter: FilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "past_due_billing") {
    return (
      client.subscription_status === "past_due" ||
      client.internal_status === "past_due"
    );
  }
  if (filter === "onboarding_tenant") {
    return client.status === "onboarding";
  }
  return client.internal_status === filter;
}

export function AdminClientsTable({ clients }: { clients: AdminClientListItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((client) => {
      if (!matchesFilter(client, filter)) return false;
      if (!q) return true;
      const haystack = [
        client.business_name,
        client.slug,
        client.domain,
        client.primary_contact_name,
        client.primary_contact_email,
        client.plan_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [clients, filter, query]);

  if (clients.length === 0) {
    return (
      <p className="text-sm text-muted">
        No clients yet. Invite your first client above.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, domain, or plan…"
          className="w-full max-w-md rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground lg:flex-1"
        />
        <p className="text-xs text-muted">
          {filtered.length} of {clients.length} clients
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setFilter(option.key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filter === option.key
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs tracking-wide text-muted uppercase">
              <th className="pb-3 font-medium">Client</th>
              <th className="pb-3 font-medium">Contact</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium">Onboarding</th>
              <th className="pb-3 font-medium">Plan / MRR</th>
              <th className="pb-3 font-medium">Billing</th>
              <th className="pb-3 font-medium">Site</th>
              <th className="pb-3 font-medium">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((client) => {
              const margin = monthlyMarginCents(
                client.monthly_price_cents,
                client.estimated_infra_cost_cents,
              );
              const internalStatus = client.internal_status;
              return (
                <tr
                  key={client.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-3 pr-4">
                    <Link
                      href={`/admin/clients/${client.id}/overview`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {client.business_name}
                    </Link>
                    <p className="text-xs text-muted">{client.slug}</p>
                  </td>
                  <td className="py-3 pr-4">
                    <p>{client.primary_contact_name ?? "—"}</p>
                    <p className="text-xs text-muted">
                      {client.primary_contact_email ?? "—"}
                    </p>
                  </td>
                  <td className="py-3 pr-4">
                    {internalStatus ? (
                      <StatusPill
                        label={INTERNAL_STATUS_LABELS[internalStatus]}
                        tone={internalStatusTone(internalStatus)}
                      />
                    ) : (
                      <StatusPill label={client.status} tone="warning" />
                    )}
                  </td>
                  <td className="py-3 pr-4 text-xs text-muted">
                    {client.onboarding_status?.replaceAll("_", " ") ?? "—"}
                  </td>
                  <td className="py-3 pr-4">
                    <p>{client.plan_name}</p>
                    <p className="text-xs text-muted">
                      {formatMoney(client.monthly_price_cents, client.currency)}{" "}
                      · margin {formatMoney(margin)}
                    </p>
                  </td>
                  <td className="py-3 pr-4">
                    <StatusPill
                      label={client.subscription_status.replace("_", " ")}
                      tone={
                        client.subscription_status === "active"
                          ? "success"
                          : client.subscription_status === "past_due"
                            ? "danger"
                            : "warning"
                      }
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <StatusPill
                      label={client.website_status}
                      tone={
                        client.website_status === "live" ? "success" : "warning"
                      }
                    />
                  </td>
                  <td className="py-3 text-xs text-muted">
                    {formatDate(client.last_activity_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
