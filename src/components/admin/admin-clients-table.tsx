"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AdminClientListItem } from "@/lib/admin/client-records";
import { INTERNAL_STATUS_LABELS, internalStatusTone } from "@/lib/admin/labels";
import type { TenantInternalStatus } from "@/lib/database/phase1-types";
import {
  DOMAIN_REGISTRARS,
  DNS_PROVIDERS,
  EMPTY_INFRASTRUCTURE_FILTERS,
  HOSTING_PLATFORMS,
  SUPABASE_PLANS,
  buildInfrastructureHealthChips,
  hasActiveInfrastructureFilters,
  matchesInfrastructureFilters,
  type InfrastructureListFilters,
} from "@/lib/technical/operations-inventory";
import { InfrastructureHealthChips } from "@/components/admin/infrastructure-health-chips";
import { PortalClientRowActions } from "@/components/admin/portal-client-row-actions";
import { StatusPill } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/utils";

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

function toggleInList<T extends string>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

function InfrastructureFilterPanel({
  filters,
  onChange,
}: {
  filters: InfrastructureListFilters;
  onChange: (next: InfrastructureListFilters) => void;
}) {
  const active = hasActiveInfrastructureFilters(filters);

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Infrastructure filters</p>
        {active ? (
          <button
            type="button"
            className="text-xs text-muted underline-offset-2 hover:underline"
            onClick={() => onChange({ ...EMPTY_INFRASTRUCTURE_FILTERS })}
          >
            Clear infrastructure filters
          </button>
        ) : null}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div>
          <p className="mb-2 text-xs font-medium text-muted uppercase">
            Supabase plan
          </p>
          <div className="flex flex-col gap-1">
            {SUPABASE_PLANS.filter((p) => p.value !== "none").map((plan) => (
              <label key={plan.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.supabasePlans.includes(plan.value)}
                  onChange={() =>
                    onChange({
                      ...filters,
                      supabasePlans: toggleInList(
                        filters.supabasePlans,
                        plan.value,
                      ),
                    })
                  }
                />
                {plan.label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted uppercase">
            Domain registrar
          </p>
          <div className="flex flex-col gap-1">
            {DOMAIN_REGISTRARS.map((reg) => (
              <label key={reg.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.domainRegistrars.includes(reg.value)}
                  onChange={() =>
                    onChange({
                      ...filters,
                      domainRegistrars: toggleInList(
                        filters.domainRegistrars,
                        reg.value,
                      ),
                    })
                  }
                />
                {reg.label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted uppercase">
            Hosting
          </p>
          <div className="flex flex-col gap-1">
            {HOSTING_PLATFORMS.filter((h) => h.value !== "other").map((host) => (
              <label key={host.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.hostingPlatforms.includes(host.value)}
                  onChange={() =>
                    onChange({
                      ...filters,
                      hostingPlatforms: toggleInList(
                        filters.hostingPlatforms,
                        host.value,
                      ),
                    })
                  }
                />
                {host.label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted uppercase">
            DNS provider
          </p>
          <div className="flex flex-col gap-1">
            {DNS_PROVIDERS.filter((d) => d.value !== "other").map((dns) => (
              <label key={dns.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.dnsProviders.includes(dns.value)}
                  onChange={() =>
                    onChange({
                      ...filters,
                      dnsProviders: toggleInList(filters.dnsProviders, dns.value),
                    })
                  }
                />
                {dns.label}
              </label>
            ))}
          </div>
          <p className="mb-2 mt-4 text-xs font-medium text-muted uppercase">
            Integrations
          </p>
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.stripeConnected}
                onChange={() =>
                  onChange({
                    ...filters,
                    stripeConnected: !filters.stripeConnected,
                  })
                }
              />
              Stripe connected
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.googleWorkspace}
                onChange={() =>
                  onChange({
                    ...filters,
                    googleWorkspace: !filters.googleWorkspace,
                  })
                }
              />
              Google Workspace
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.resendPro}
                onChange={() =>
                  onChange({
                    ...filters,
                    resendPro: !filters.resendPro,
                  })
                }
              />
              Resend Pro
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminClientsTable({ clients }: { clients: AdminClientListItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [infraFilters, setInfraFilters] = useState<InfrastructureListFilters>({
    ...EMPTY_INFRASTRUCTURE_FILTERS,
  });
  const [showInfraFilters, setShowInfraFilters] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((client) => {
      if (!matchesFilter(client, filter)) return false;
      if (!matchesInfrastructureFilters(client.infrastructure, infraFilters)) {
        return false;
      }
      if (!q) return true;
      const chipText = buildInfrastructureHealthChips(
        client.infrastructureProfile,
      )
        .map((c) => c.detail)
        .join(" ");
      const haystack = [
        client.business_name,
        client.slug,
        client.domain,
        client.primary_contact_name,
        client.primary_contact_email,
        client.plan_name,
        chipText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [clients, filter, infraFilters, query]);

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
          placeholder="Search by name, email, domain, plan, or infrastructure…"
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
        <button
          type="button"
          onClick={() => setShowInfraFilters((v) => !v)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            showInfraFilters || hasActiveInfrastructureFilters(infraFilters)
              ? "border-foreground bg-foreground text-background"
              : "border-border text-muted hover:text-foreground"
          }`}
        >
          Infrastructure
        </button>
      </div>

      {showInfraFilters ? (
        <InfrastructureFilterPanel
          filters={infraFilters}
          onChange={setInfraFilters}
        />
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs tracking-wide text-muted uppercase">
              <th className="pb-3 font-medium">Client</th>
              <th className="pb-3 font-medium">Infrastructure health</th>
              <th className="pb-3 font-medium">Contact</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium">Plan / Effective MRR</th>
              <th className="pb-3 font-medium">Billing</th>
              <th className="pb-3 font-medium">Last activity</th>
              <th className="pb-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((client) => {
              const financials = client.recurringFinancials;
              const internalStatus = client.internal_status;
              const infraChips = buildInfrastructureHealthChips(
                client.infrastructureProfile,
              );
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
                  <td className="max-w-[220px] py-3 pr-4">
                    <InfrastructureHealthChips chips={infraChips} max={5} />
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
                  <td className="py-3 pr-4">
                    <p>{client.plan_name}</p>
                    <p className="text-xs font-medium">{formatMoney(financials.effectiveMrrCents, client.currency)} MRR</p>
                    {financials.activeRecurringDiscountMrrCents > 0 ? (
                      <p className="text-xs text-muted">
                        {formatMoney(financials.baseRecurringMrrCents, client.currency)} base · {formatMoney(financials.activeRecurringDiscountMrrCents, client.currency)} {financials.discountKind === "ongoing" ? "ongoing" : "temporary"} discount
                      </p>
                    ) : null}
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
                  <td className="py-3 text-xs text-muted">
                    {formatDate(client.last_activity_at)}
                  </td>
                  <td className="py-3">
                    <PortalClientRowActions tenantId={client.id} />
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
