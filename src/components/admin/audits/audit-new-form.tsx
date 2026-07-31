"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button, Panel } from "@/components/ui";
import type { AdminRunAuditInput } from "@/lib/audit/admin/validation";

type TenantOption = { id: string; name: string };

const PHASES = [
  "Collecting website data",
  "Scoring findings",
  "Building recommendations",
  "Finalizing report",
] as const;

export function AuditNewForm({
  tenants,
  initialTenantId,
  initialUrl,
}: {
  tenants: TenantOption[];
  initialTenantId?: string;
  initialUrl?: string;
}) {
  const router = useRouter();
  const [rawUrl, setRawUrl] = useState(initialUrl ?? "");
  const [scopeChoice, setScopeChoice] =
    useState<AdminRunAuditInput["scopeChoice"]>(
      initialTenantId ? "client_health" : "website",
    );
  const [tenantId, setTenantId] = useState(initialTenantId ?? "");
  const [businessName, setBusinessName] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    if (!submitting) return;
    const timer = window.setInterval(() => {
      setPhaseIndex((current) => Math.min(current + 1, PHASES.length - 1));
    }, 4000);
    return () => window.clearInterval(timer);
  }, [submitting]);

  const tenantRequired = scopeChoice === "client_health";

  const selectedTenantName = useMemo(
    () => tenants.find((tenant) => tenant.id === tenantId)?.name ?? null,
    [tenantId, tenants],
  );

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    setPhaseIndex(0);

    try {
      const response = await fetch("/api/admin/audits/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawUrl,
          scopeChoice,
          tenantId: tenantId || null,
          businessName: businessName || null,
          internalNotes: internalNotes || null,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        runId?: string;
      };

      if (!response.ok || !payload.runId) {
        throw new Error(payload.error ?? "Audit failed.");
      }

      setPhaseIndex(PHASES.length - 1);
      router.push(`/admin/audits/${payload.runId}`);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Audit failed.",
      );
      setSubmitting(false);
    }
  }

  return (
    <Panel title="Run website audit">
      <form onSubmit={onSubmit} className="space-y-5">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Website URL</span>
          <input
            required
            type="url"
            value={rawUrl}
            onChange={(event) => setRawUrl(event.target.value)}
            placeholder="https://example.com"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            disabled={submitting}
          />
        </label>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Audit scope</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="scope"
              checked={scopeChoice === "website"}
              onChange={() => setScopeChoice("website")}
              disabled={submitting}
            />
            Website health check (standard scope)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="scope"
              checked={scopeChoice === "client_health"}
              onChange={() => setScopeChoice("client_health")}
              disabled={submitting}
            />
            Client Health audit (includes Operations Inventory)
          </label>
        </fieldset>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">
            Client / tenant {tenantRequired ? "(required)" : "(optional)"}
          </span>
          <select
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            disabled={submitting}
            required={tenantRequired}
          >
            <option value="">No tenant</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
          {selectedTenantName ? (
            <p className="text-xs text-muted">Selected: {selectedTenantName}</p>
          ) : null}
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Business name (optional)</span>
          <input
            type="text"
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            disabled={submitting}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Internal notes</span>
          <textarea
            value={internalNotes}
            onChange={(event) => setInternalNotes(event.target.value)}
            rows={4}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            disabled={submitting}
          />
        </label>

        {submitting ? (
          <div className="rounded-md border border-border bg-background p-4">
            <p className="text-sm font-medium">Running audit synchronously…</p>
            <p className="mt-1 text-sm text-muted">This may take up to a few minutes.</p>
            <ol className="mt-3 space-y-1 text-sm">
              {PHASES.map((phase, index) => (
                <li
                  key={phase}
                  className={index <= phaseIndex ? "text-foreground" : "text-muted"}
                >
                  {index < phaseIndex ? "✓ " : index === phaseIndex ? "… " : "○ "}
                  {phase}
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Running audit…" : "Run audit"}
          </Button>
          <Link
            href="/admin/audits"
            className="inline-flex items-center rounded-md border border-border px-4 py-2.5 text-sm"
          >
            Cancel
          </Link>
        </div>
      </form>
    </Panel>
  );
}
