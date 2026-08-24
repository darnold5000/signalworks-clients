"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Panel } from "@/components/ui";
import { InclusionItemsEditor } from "@/components/inclusion-items-editor";
import type { Client } from "@/lib/types";
import {
  WEBSITE_SECURITY_LABELS,
  type WebsiteSecurityStatus,
} from "@/lib/portal/website-security";
import { resolveWebsiteSecurityStatus } from "@/lib/portal/website-security";

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function AdminPortalWebsiteForm({ client }: { client: Client }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const securityStatus = resolveWebsiteSecurityStatus(client);

  const [domain, setDomain] = useState(client.domain ?? "");
  const [hostingStatus, setHostingStatus] = useState(client.hosting_status);
  const [lastUpdated, setLastUpdated] = useState(
    toDatetimeLocalValue(client.website_last_updated_at),
  );
  const [websiteSecurityStatus, setWebsiteSecurityStatus] =
    useState<WebsiteSecurityStatus>(securityStatus);
  const [httpsEnabled, setHttpsEnabled] = useState(
    client.website_security_https_enabled ?? true,
  );
  const [certValid, setCertValid] = useState(
    client.website_security_cert_valid ?? true,
  );
  const [certExpires, setCertExpires] = useState(
    toDatetimeLocalValue(client.website_security_cert_expires_at),
  );
  const [planInclusions, setPlanInclusions] = useState(client.plan_inclusions);
  const [setupInclusions, setSetupInclusions] = useState(client.setup_inclusions);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/clients/${client.id}/portal-settings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            domain: domain.trim() || null,
            hosting_status: hostingStatus,
            website_last_updated_at: fromDatetimeLocalValue(lastUpdated),
            website_security_status: websiteSecurityStatus,
            website_security_https_enabled: httpsEnabled,
            website_security_cert_valid: certValid,
            website_security_cert_expires_at: fromDatetimeLocalValue(certExpires),
            plan_inclusions: planInclusions,
            setup_inclusions: setupInclusions,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save");
        return;
      }
      setMessage("Saved. Clients will see updates on their overview.");
      router.refresh();
    } catch {
      setError("Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Portal website card (client-facing)">
      <p className="mb-4 text-sm text-muted">
        These fields power the Website information card in the client portal.
        Clients cannot edit them here.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm">
          <span className="font-medium">Domain</span>
          <input
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium">Hosting status</span>
          <select
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={hostingStatus}
            onChange={(e) =>
              setHostingStatus(e.target.value as Client["hosting_status"])
            }
          >
            <option value="active">active</option>
            <option value="pending">pending</option>
            <option value="error">error</option>
            <option value="none">none</option>
          </select>
        </label>

        <label className="block text-sm">
          <span className="font-medium">Last update (shown to client)</span>
          <input
            type="datetime-local"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={lastUpdated}
            onChange={(e) => setLastUpdated(e.target.value)}
          />
        </label>

        <fieldset className="space-y-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-medium">Website security</legend>
          <label className="block text-sm">
            <span className="font-medium">Status</span>
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={websiteSecurityStatus}
              onChange={(e) =>
                setWebsiteSecurityStatus(
                  e.target.value as WebsiteSecurityStatus,
                )
              }
            >
              {(Object.keys(WEBSITE_SECURITY_LABELS) as WebsiteSecurityStatus[]).map(
                (key) => (
                  <option key={key} value={key}>
                    {WEBSITE_SECURITY_LABELS[key]}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={httpsEnabled}
              onChange={(e) => setHttpsEnabled(e.target.checked)}
            />
            HTTPS enabled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={certValid}
              onChange={(e) => setCertValid(e.target.checked)}
            />
            SSL certificate valid
          </label>
          <label className="block text-sm">
            <span className="font-medium">Certificate expires</span>
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={certExpires}
              onChange={(e) => setCertExpires(e.target.value)}
            />
          </label>
        </fieldset>

        <fieldset className="space-y-4 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-medium">Plan inclusions</legend>
          <InclusionItemsEditor
            label="Included with this Plan"
            items={planInclusions}
            onChange={setPlanInclusions}
          />
          <InclusionItemsEditor
            label="Included Setup"
            items={setupInclusions}
            onChange={setSetupInclusions}
          />
        </fieldset>

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        {message ? <p className="text-sm text-muted">{message}</p> : null}

        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save portal website info"}
        </Button>
      </form>
    </Panel>
  );
}
