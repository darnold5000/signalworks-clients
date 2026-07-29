"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminClientBundle } from "@/lib/admin/client-records";
import type { TenantTechnicalProfile } from "@/lib/database/phase1-types";
import {
  ACCESS_VENDOR_KEYS,
  ACCESS_VENDOR_LABELS,
  DATABASE_PROVIDERS,
  DEPLOYMENT_ENVIRONMENTS,
  DNS_PROVIDERS,
  DOMAIN_EMAIL_PROVIDERS,
  DOMAIN_REGISTRARS,
  EMAIL_PROVIDERS,
  HOSTING_PLATFORMS,
  RESEND_TIERS,
  SERVICE_OWNER_VALUES,
  SERVICE_OWNERSHIP_KEYS,
  SERVICE_OWNERSHIP_LABELS,
  SSL_STATUSES,
  STRIPE_CONNECTION_STATUSES,
  SUPABASE_PLANS,
  THIRD_PARTY_INTEGRATION_KEYS,
  THIRD_PARTY_INTEGRATION_LABELS,
  parseAccessStatus,
  parseBusinessServices,
  parseMonitoringConfig,
  parseServiceOwnership,
  parseThirdPartyIntegrations,
  type AccessVendorKey,
  type ServiceOwnershipKey,
} from "@/lib/technical/operations-inventory";
import { Button, Panel } from "@/components/ui";

const inputClassName =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm";
const labelClassName = "mb-1 block text-xs font-medium text-muted";

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <span className={labelClassName}>{label}</span>
      {children}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <Field label={label}>
      <select
        className={inputClassName}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="text"
        className={inputClassName}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="size-4 rounded border-border"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function emptyAccessEntry() {
  return {
    signal_works_access: false,
    client_access: false,
    recovery_configured: false,
    mfa_enabled: false,
    notes: "",
  };
}

function profileToFormState(
  technical: TenantTechnicalProfile | null,
  clientProductionUrl: string | null,
): Record<string, unknown> {
  const ownership = parseServiceOwnership(
    technical?.service_ownership,
    technical?.managed_services,
  );
  const access = parseAccessStatus(technical?.access_status);
  const business = parseBusinessServices(technical?.business_services);
  const monitoring = parseMonitoringConfig(technical?.monitoring_config);
  const integrations = parseThirdPartyIntegrations(technical?.api_integrations);

  const accessForm: Record<string, ReturnType<typeof emptyAccessEntry>> = {};
  for (const key of ACCESS_VENDOR_KEYS) {
    const e = access[key];
    accessForm[key] = e
      ? {
          signal_works_access: e.signal_works_access,
          client_access: e.client_access,
          recovery_configured: e.recovery_configured,
          mfa_enabled: e.mfa_enabled,
          notes: e.notes ?? "",
        }
      : emptyAccessEntry();
  }

  return {
    production_url: technical?.production_url ?? clientProductionUrl ?? "",
    primary_domain: technical?.primary_domain ?? "",
    deployment_environment: technical?.deployment_environment ?? "",
    domain_registrar: technical?.domain_registrar ?? "",
    dns_provider: technical?.dns_provider ?? "",
    hosting_provider: technical?.hosting_provider ?? "",
    deployment_platform:
      technical?.deployment_platform ?? technical?.hosting_provider ?? "",
    hosting_project_name: technical?.hosting_project_name ?? "",
    hosting_project_id: technical?.hosting_project_id ?? "",
    hosting_team_name: technical?.hosting_team_name ?? "",
    hosting_auto_deploy: technical?.hosting_auto_deploy ?? false,
    ssl_status: technical?.ssl_status ?? "",
    repository_owner: technical?.repository_owner ?? "",
    repository_name: technical?.repository_name ?? "",
    repository_url: technical?.repository_url ?? "",
    default_branch: technical?.default_branch ?? "main",
    database_provider: technical?.database_provider ?? "",
    database_project_name: technical?.database_project_name ?? "",
    database_project_reference: technical?.database_project_reference ?? "",
    database_region: technical?.database_region ?? "",
    database_plan: technical?.database_plan ?? "",
    database_shared_platform: technical?.database_shared_platform ?? null,
    database_production_dedicated:
      technical?.database_production_dedicated ?? null,
    database_infrastructure_notes:
      technical?.database_infrastructure_notes ?? "",
    backup_policy: technical?.backup_policy ?? "",
    email_provider: technical?.email_provider ?? "",
    email_provider_tier: technical?.email_provider_tier ?? "",
    email_sending_domain: technical?.email_sending_domain ?? "",
    google_workspace_enabled: technical?.google_workspace_enabled ?? false,
    domain_email_provider: technical?.domain_email_provider ?? "",
    stripe_connection_status: technical?.stripe_connection_status ?? "",
    stripe_platform_account_id:
      technical?.stripe_platform_account_id ??
      technical?.stripe_connected_account_id ??
      "",
    stripe_connected_account_id: technical?.stripe_connected_account_id ?? "",
    stripe_test_mode_enabled: technical?.stripe_test_mode_enabled ?? false,
    stripe_live_enabled: technical?.stripe_live_enabled ?? false,
    analytics_provider: technical?.analytics_provider ?? "",
    analytics_property_id: technical?.analytics_property_id ?? "",
    business_cloudflare: Boolean(business.cloudflare?.enabled),
    business_monitoring: Boolean(
      business.monitoring?.enabled ?? monitoring.uptime_monitoring,
    ),
    business_backups: Boolean(
      business.backups?.enabled ?? monitoring.backups_dashboard,
    ),
    deployment_notes: technical?.deployment_notes ?? "",
    technical_notes: technical?.technical_notes ?? "",
    service_ownership: ownership,
    access_status: accessForm,
    api_integrations: integrations,
    monitoring_config: monitoring,
  };
}

export function TechnicalProfileForm({
  tenantId,
  bundle,
}: {
  tenantId: string;
  bundle: AdminClientBundle;
}) {
  const router = useRouter();
  const initial = useMemo(
    () =>
      profileToFormState(
        bundle.technical,
        bundle.client.website_url ?? bundle.profile?.website_url ?? null,
      ),
    [bundle],
  );

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function setField(key: string, value: unknown) {
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setOwner(key: ServiceOwnershipKey, value: string) {
    setSaved(false);
    setForm((prev) => ({
      ...prev,
      service_ownership: {
        ...(prev.service_ownership as Record<string, string>),
        [key]: value,
      },
    }));
  }

  function setAccess(
    vendor: AccessVendorKey,
    patch: Partial<ReturnType<typeof emptyAccessEntry>>,
  ) {
    setSaved(false);
    setForm((prev) => {
      const current = (prev.access_status as Record<
        string,
        ReturnType<typeof emptyAccessEntry>
      >) ?? {};
      return {
        ...prev,
        access_status: {
          ...current,
          [vendor]: { ...current[vendor] ?? emptyAccessEntry(), ...patch },
        },
      };
    });
  }

  function setIntegration(
    key: string,
    patch: Partial<{ enabled: boolean; account_owner: string; notes: string }>,
  ) {
    setSaved(false);
    setForm((prev) => {
      const current = (prev.api_integrations as Record<
        string,
        { enabled: boolean; account_owner: string; notes: string }
      >) ?? {};
      const entry = current[key] ?? {
        enabled: false,
        account_owner: "",
        notes: "",
      };
      return {
        ...prev,
        api_integrations: {
          ...current,
          [key]: { ...entry, ...patch },
        },
      };
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const monitoring = (form.monitoring_config ?? {}) as Record<string, boolean>;
    const payload = {
      ...form,
      hosting_auto_deploy: Boolean(form.hosting_auto_deploy),
      google_workspace_enabled: Boolean(form.google_workspace_enabled),
      stripe_test_mode_enabled: Boolean(form.stripe_test_mode_enabled),
      stripe_live_enabled: Boolean(form.stripe_live_enabled),
      business_services: {
        cloudflare: { enabled: Boolean(form.business_cloudflare) },
        monitoring: { enabled: Boolean(form.business_monitoring) },
        backups: { enabled: Boolean(form.business_backups) },
      },
      monitoring_config: {
        ...monitoring,
        uptime_monitoring: Boolean(form.business_monitoring),
        backups_dashboard: Boolean(form.business_backups),
      },
    };

    const res = await fetch(`/api/admin/clients/${tenantId}/technical`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not save operations inventory.");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  const ownership = (form.service_ownership ?? {}) as Record<string, string>;
  const access = (form.access_status ?? {}) as Record<
    string,
    ReturnType<typeof emptyAccessEntry>
  >;
  const integrations = (form.api_integrations ?? {}) as Record<
    string,
    { enabled: boolean; account_owner: string; notes: string }
  >;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Operations inventory saved.
        </p>
      ) : null}

      <Panel title="1. Infrastructure">
        <p className="mb-4 text-sm text-muted">Hosting stack and deployment.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Website URL"
            value={String(form.production_url ?? "")}
            onChange={(v) => setField("production_url", v)}
          />
          <TextField
            label="Primary domain"
            value={String(form.primary_domain ?? "")}
            onChange={(v) => setField("primary_domain", v)}
          />
          <SelectField
            label="Domain registrar"
            value={String(form.domain_registrar ?? "")}
            onChange={(v) => setField("domain_registrar", v)}
            options={DOMAIN_REGISTRARS}
          />
          <SelectField
            label="DNS provider"
            value={String(form.dns_provider ?? "")}
            onChange={(v) => setField("dns_provider", v)}
            options={DNS_PROVIDERS}
          />
          <SelectField
            label="Hosting provider"
            value={String(form.hosting_provider ?? "")}
            onChange={(v) => setField("hosting_provider", v)}
            options={HOSTING_PLATFORMS}
          />
          <SelectField
            label="Deployment platform"
            value={String(form.deployment_platform ?? "")}
            onChange={(v) => setField("deployment_platform", v)}
            options={HOSTING_PLATFORMS}
          />
          <SelectField
            label="Environment"
            value={String(form.deployment_environment ?? "")}
            onChange={(v) => setField("deployment_environment", v)}
            options={DEPLOYMENT_ENVIRONMENTS}
          />
          <SelectField
            label="SSL status"
            value={String(form.ssl_status ?? "")}
            onChange={(v) => setField("ssl_status", v)}
            options={SSL_STATUSES}
          />
          <TextField
            label="GitHub owner / org"
            value={String(form.repository_owner ?? "")}
            onChange={(v) => setField("repository_owner", v)}
          />
          <TextField
            label="GitHub repository"
            value={String(form.repository_name ?? "")}
            onChange={(v) => setField("repository_name", v)}
          />
          <TextField
            label="Production branch"
            value={String(form.default_branch ?? "")}
            onChange={(v) => setField("default_branch", v)}
          />
          <TextField
            label="Vercel project"
            value={String(form.hosting_project_name ?? "")}
            onChange={(v) => setField("hosting_project_name", v)}
          />
          <TextField
            label="Vercel team / account"
            value={String(form.hosting_team_name ?? "")}
            onChange={(v) => setField("hosting_team_name", v)}
          />
          <CheckboxField
            label="Auto deploy enabled"
            checked={Boolean(form.hosting_auto_deploy)}
            onChange={(v) => setField("hosting_auto_deploy", v)}
          />
        </div>
      </Panel>

      <Panel title="2. Data platform">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Database provider"
            value={String(form.database_provider ?? "")}
            onChange={(v) => setField("database_provider", v)}
            options={DATABASE_PROVIDERS}
          />
          <TextField
            label="Project name"
            value={String(form.database_project_name ?? "")}
            onChange={(v) => setField("database_project_name", v)}
          />
          <TextField
            label="Project ref"
            value={String(form.database_project_reference ?? "")}
            onChange={(v) => setField("database_project_reference", v)}
          />
          <SelectField
            label="Plan"
            value={String(form.database_plan ?? "")}
            onChange={(v) => setField("database_plan", v)}
            options={SUPABASE_PLANS}
          />
          <Field label="Shared platform DB?">
            <select
              className={inputClassName}
              value={
                form.database_shared_platform === true
                  ? "yes"
                  : form.database_shared_platform === false
                    ? "no"
                    : ""
              }
              onChange={(e) =>
                setField(
                  "database_shared_platform",
                  e.target.value === "yes"
                    ? true
                    : e.target.value === "no"
                      ? false
                      : null,
                )
              }
            >
              <option value="">—</option>
              <option value="yes">Yes (multitenant)</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="Dedicated production DB?">
            <select
              className={inputClassName}
              value={
                form.database_production_dedicated === true
                  ? "yes"
                  : form.database_production_dedicated === false
                    ? "no"
                    : ""
              }
              onChange={(e) =>
                setField(
                  "database_production_dedicated",
                  e.target.value === "yes"
                    ? true
                    : e.target.value === "no"
                      ? false
                      : null,
                )
              }
            >
              <option value="">—</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
          <TextField
            label="Backup strategy"
            value={String(form.backup_policy ?? "")}
            onChange={(v) => setField("backup_policy", v)}
          />
          <div className="sm:col-span-2">
            <Field label="Notes">
              <textarea
                className={`${inputClassName} min-h-[80px]`}
                value={String(form.database_infrastructure_notes ?? "")}
                onChange={(e) =>
                  setField("database_infrastructure_notes", e.target.value)
                }
              />
            </Field>
          </div>
        </div>
      </Panel>

      <Panel title="3. Business services">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Stripe"
            value={String(form.stripe_connection_status ?? "")}
            onChange={(v) => setField("stripe_connection_status", v)}
            options={STRIPE_CONNECTION_STATUSES}
          />
          <TextField
            label="Stripe account ID"
            value={String(form.stripe_platform_account_id ?? "")}
            onChange={(v) => setField("stripe_platform_account_id", v)}
          />
          <CheckboxField
            label="Google Workspace"
            checked={Boolean(form.google_workspace_enabled)}
            onChange={(v) => setField("google_workspace_enabled", v)}
          />
          <SelectField
            label="Domain email"
            value={String(form.domain_email_provider ?? "")}
            onChange={(v) => setField("domain_email_provider", v)}
            options={DOMAIN_EMAIL_PROVIDERS}
          />
          <SelectField
            label="Resend"
            value={String(form.email_provider ?? "")}
            onChange={(v) => setField("email_provider", v)}
            options={EMAIL_PROVIDERS}
          />
          <SelectField
            label="Resend plan"
            value={String(form.email_provider_tier ?? "")}
            onChange={(v) => setField("email_provider_tier", v)}
            options={RESEND_TIERS}
          />
          <TextField
            label="Resend sending domain"
            value={String(form.email_sending_domain ?? "")}
            onChange={(v) => setField("email_sending_domain", v)}
          />
          <TextField
            label="Analytics provider"
            value={String(form.analytics_provider ?? "")}
            onChange={(v) => setField("analytics_provider", v)}
          />
          <CheckboxField
            label="Cloudflare (business / CDN)"
            checked={Boolean(form.business_cloudflare)}
            onChange={(v) => setField("business_cloudflare", v)}
          />
          <CheckboxField
            label="Monitoring in use"
            checked={Boolean(form.business_monitoring)}
            onChange={(v) => setField("business_monitoring", v)}
          />
          <CheckboxField
            label="Backups in use"
            checked={Boolean(form.business_backups)}
            onChange={(v) => setField("business_backups", v)}
          />
        </div>
      </Panel>

      <Panel title="4. Third-party integrations">
        <div className="space-y-3">
          {THIRD_PARTY_INTEGRATION_KEYS.map((key) => {
            const entry = integrations[key] ?? {
              enabled: false,
              account_owner: "",
              notes: "",
            };
            return (
              <div key={key} className="rounded-lg border border-border p-3">
                <CheckboxField
                  label={THIRD_PARTY_INTEGRATION_LABELS[key]}
                  checked={entry.enabled}
                  onChange={(v) => setIntegration(key, { enabled: v })}
                />
                {entry.enabled ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <TextField
                      label="Account owner"
                      value={entry.account_owner}
                      onChange={(v) =>
                        setIntegration(key, { account_owner: v })
                      }
                    />
                    <TextField
                      label="Notes"
                      value={entry.notes}
                      onChange={(v) => setIntegration(key, { notes: v })}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="5. Signal Works responsibility">
        <p className="mb-4 text-sm text-muted">
          Who can troubleshoot or change each service?
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted uppercase">
                <th className="pb-2 font-medium">Service</th>
                <th className="pb-2 font-medium">Owner</th>
              </tr>
            </thead>
            <tbody>
              {SERVICE_OWNERSHIP_KEYS.map((key) => (
                <tr key={key} className="border-b border-border last:border-0">
                  <td className="py-2 pr-4">{SERVICE_OWNERSHIP_LABELS[key]}</td>
                  <td className="py-2">
                    <select
                      className={inputClassName}
                      value={ownership[key] ?? ""}
                      onChange={(e) => setOwner(key, e.target.value)}
                    >
                      {SERVICE_OWNER_VALUES.map((o) => (
                        <option key={o.value || "empty"} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="6. Credentials & access (metadata only)">
        <p className="mb-4 text-sm text-muted">
          No passwords — only whether Signal Works can log in and MFA/recovery
          status.
        </p>
        <div className="space-y-4">
          {ACCESS_VENDOR_KEYS.map((vendor) => {
            const entry = access[vendor] ?? emptyAccessEntry();
            return (
              <div key={vendor} className="rounded-lg border border-border p-3">
                <p className="font-medium">{ACCESS_VENDOR_LABELS[vendor]}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <CheckboxField
                    label="Signal Works has access"
                    checked={entry.signal_works_access}
                    onChange={(v) =>
                      setAccess(vendor, { signal_works_access: v })
                    }
                  />
                  <CheckboxField
                    label="Client has access"
                    checked={entry.client_access}
                    onChange={(v) => setAccess(vendor, { client_access: v })}
                  />
                  <CheckboxField
                    label="Recovery configured"
                    checked={entry.recovery_configured}
                    onChange={(v) =>
                      setAccess(vendor, { recovery_configured: v })
                    }
                  />
                  <CheckboxField
                    label="MFA enabled"
                    checked={entry.mfa_enabled}
                    onChange={(v) => setAccess(vendor, { mfa_enabled: v })}
                  />
                </div>
                <div className="mt-2">
                  <TextField
                    label="Notes"
                    value={entry.notes}
                    onChange={(v) => setAccess(vendor, { notes: v })}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Internal notes">
        <div className="grid gap-4">
          <Field label="Deployment notes">
            <textarea
              className={`${inputClassName} min-h-[80px]`}
              value={String(form.deployment_notes ?? "")}
              onChange={(e) => setField("deployment_notes", e.target.value)}
            />
          </Field>
          <Field label="Technical notes">
            <textarea
              className={`${inputClassName} min-h-[80px]`}
              value={String(form.technical_notes ?? "")}
              onChange={(e) => setField("technical_notes", e.target.value)}
            />
          </Field>
        </div>
      </Panel>

      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save operations inventory"}
      </Button>
    </form>
  );
}
