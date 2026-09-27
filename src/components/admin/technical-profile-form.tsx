"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminClientBundle } from "@/lib/admin/client-records";
import type { TenantTechnicalProfile } from "@/lib/database/phase1-types";
import {
  THIRD_PARTY_INTEGRATION_LABELS,
  parseThirdPartyIntegrations,
} from "@/lib/technical/operations-inventory";
import { Button, Panel } from "@/components/ui";

const inputClassName =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm";
const labelClassName = "mb-1 block text-xs font-medium text-muted";
const firstClassIntegrationKeys = new Set([
  "twilio",
  "stripe",
  "resend",
  "supabase",
  "vercel",
  "github",
]);

type IntegrationEntry = {
  enabled: boolean;
  name: string | null;
  account_owner: string | null;
  notes: string | null;
};

type TechnicalFormState = {
  primary_domain: string;
  domain_registrar: string;
  hosting_provider: string;
  uptime_robot_monitor_id: string;
  database_provider: string;
  repository_owner: string;
  payment_provider: string;
  payment_method_notes: string;
  stripe_platform_account_id: string;
  email_provider: string;
  email_sending_domain: string;
  sms_provider: string;
  twilio_account_sid: string;
  twilio_phone_number: string;
  twilio_number_type: string;
  sms_enabled: boolean;
  api_integrations: Record<string, IntegrationEntry>;
  technical_notes: string;
};

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
    <label className={className}>
      <span className={labelClassName}>{label}</span>
      {children}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <input
        type="text"
        className={inputClassName}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function ProviderField({
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
  const listId = `provider-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <Field label={label}>
      <input
        type="text"
        list={listId}
        className={inputClassName}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </datalist>
    </Field>
  );
}

function inferredPaymentProvider(
  technical: TenantTechnicalProfile | null,
): string {
  if (technical?.payment_provider) return technical.payment_provider;
  if (
    technical?.stripe_connection_status === "connected" ||
    technical?.stripe_connection_status === "pending" ||
    technical?.stripe_platform_account_id ||
    technical?.stripe_connected_account_id
  ) {
    return "stripe";
  }
  return technical?.stripe_connection_status === "not_used" ? "none" : "";
}

function domainFromWebsite(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).hostname;
  } catch {
    return value;
  }
}

export function profileToTechnologyFormState(
  technical: TenantTechnicalProfile | null,
  clientDomain: string | null,
  clientWebsiteUrl: string | null,
): TechnicalFormState {
  return {
    primary_domain:
      technical?.primary_domain ??
      clientDomain ??
      domainFromWebsite(technical?.production_url ?? clientWebsiteUrl),
    domain_registrar: technical?.domain_registrar ?? "",
    hosting_provider: technical?.hosting_provider ?? "",
    uptime_robot_monitor_id: technical?.uptime_robot_monitor_id ?? "",
    database_provider: technical?.database_provider ?? "",
    repository_owner: technical?.repository_owner ?? "",
    payment_provider: inferredPaymentProvider(technical),
    payment_method_notes: technical?.payment_method_notes ?? "",
    stripe_platform_account_id:
      technical?.stripe_platform_account_id ??
      technical?.stripe_connected_account_id ??
      "",
    email_provider: technical?.email_provider ?? "",
    email_sending_domain: technical?.email_sending_domain ?? "",
    sms_provider: technical?.sms_provider ?? "",
    twilio_account_sid: technical?.twilio_account_sid ?? "",
    twilio_phone_number: technical?.twilio_phone_number ?? "",
    twilio_number_type: technical?.twilio_number_type ?? "",
    sms_enabled: technical?.sms_enabled ?? false,
    api_integrations: parseThirdPartyIntegrations(
      technical?.api_integrations,
    ),
    technical_notes: technical?.technical_notes ?? "",
  };
}

function integrationName(key: string, entry: IntegrationEntry): string {
  return (
    entry.name?.trim() ||
    THIRD_PARTY_INTEGRATION_LABELS[
      key as keyof typeof THIRD_PARTY_INTEGRATION_LABELS
    ] ||
    key.replace(/^custom_/, "").replaceAll("_", " ")
  );
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
      profileToTechnologyFormState(
        bundle.technical,
        bundle.client.domain,
        bundle.client.website_url ?? bundle.profile?.website_url ?? null,
      ),
    [bundle],
  );
  const [form, setForm] = useState(initial);
  const [newIntegrationName, setNewIntegrationName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function setField<K extends keyof TechnicalFormState>(
    key: K,
    value: TechnicalFormState[K],
  ) {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  }

  function addIntegration() {
    const name = newIntegrationName.trim();
    if (!name) return;
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    let key = `custom_${slug || "integration"}`;
    let suffix = 2;
    while (form.api_integrations[key]) key = `custom_${slug}_${suffix++}`;
    setField("api_integrations", {
      ...form.api_integrations,
      [key]: { enabled: true, name, account_owner: null, notes: null },
    });
    setNewIntegrationName("");
  }

  function removeIntegration(key: string) {
    const next = { ...form.api_integrations };
    delete next[key];
    setField("api_integrations", next);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    const paymentProvider = form.payment_provider.trim().toLowerCase();
    const response = await fetch(`/api/admin/clients/${tenantId}/technical`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        stripe_connection_status:
          paymentProvider === "stripe" ? "connected" : "not_used",
      }),
    });

    setSaving(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(data.error ?? "Could not save technology and services.");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  const paymentProvider = form.payment_provider.trim().toLowerCase();
  const emailProvider = form.email_provider.trim().toLowerCase();
  const smsProvider = form.sms_provider.trim().toLowerCase();
  const integrations = Object.entries(form.api_integrations).filter(
    ([key, entry]) => entry.enabled && !firstClassIntegrationKeys.has(key),
  );

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Technology and services saved.
        </p>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel title="Website & Infrastructure">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Website domain or URL" value={form.primary_domain} onChange={(value) => setField("primary_domain", value)} placeholder="example.com" />
            <ProviderField label="Domain registrar" value={form.domain_registrar} onChange={(value) => setField("domain_registrar", value)} options={[{ value: "cloudflare", label: "Cloudflare" }, { value: "wix", label: "Wix" }, { value: "godaddy", label: "GoDaddy" }, { value: "namecheap", label: "Namecheap" }, { value: "other", label: "Other" }]} />
            <ProviderField label="Hosting" value={form.hosting_provider} onChange={(value) => setField("hosting_provider", value)} options={[{ value: "vercel", label: "Vercel" }, { value: "other", label: "Other" }]} />
            <TextField label="UptimeRobot monitor ID" value={form.uptime_robot_monitor_id} onChange={(value) => setField("uptime_robot_monitor_id", value)} placeholder="123456789" />
            <ProviderField label="Database" value={form.database_provider} onChange={(value) => setField("database_provider", value)} options={[{ value: "supabase", label: "Supabase" }, { value: "other", label: "Other" }, { value: "none", label: "None" }]} />
            <div className="sm:col-span-2">
              <TextField label="GitHub owner / org" value={form.repository_owner} onChange={(value) => setField("repository_owner", value)} placeholder="Signal Works" />
            </div>
          </div>
        </Panel>

        <Panel title="Payments">
          <div className="grid gap-4">
            <ProviderField label="Payment provider" value={form.payment_provider} onChange={(value) => setField("payment_provider", value)} options={[{ value: "stripe", label: "Stripe" }, { value: "manual", label: "Manual" }, { value: "none", label: "None" }, { value: "other", label: "Other" }]} />
            {paymentProvider === "stripe" ? (
              <TextField label="Stripe Account ID" value={form.stripe_platform_account_id} onChange={(value) => setField("stripe_platform_account_id", value)} placeholder="acct_…" />
            ) : null}
            {paymentProvider === "manual" ? (
              <Field label="Payment method / notes">
                <textarea className={`${inputClassName} min-h-24`} value={form.payment_method_notes} onChange={(event) => setField("payment_method_notes", event.target.value)} placeholder="Venmo QR, cash/check, external invoice…" />
              </Field>
            ) : null}
          </div>
        </Panel>

        <Panel title="Communications">
          <div className="grid gap-4 sm:grid-cols-2">
            <ProviderField label="Email provider" value={form.email_provider} onChange={(value) => setField("email_provider", value)} options={[{ value: "resend", label: "Resend" }, { value: "sendgrid", label: "Twilio SendGrid" }, { value: "none", label: "None" }, { value: "other", label: "Other" }]} />
            {emailProvider && emailProvider !== "none" ? (
              <TextField label="Sending domain" value={form.email_sending_domain} onChange={(value) => setField("email_sending_domain", value)} />
            ) : null}
            <ProviderField label="SMS provider" value={form.sms_provider} onChange={(value) => setField("sms_provider", value)} options={[{ value: "twilio", label: "Twilio" }, { value: "none", label: "None" }, { value: "other", label: "Other" }]} />
            {smsProvider === "twilio" ? (
              <>
                <TextField label="Twilio Account SID" value={form.twilio_account_sid} onChange={(value) => setField("twilio_account_sid", value)} placeholder="AC…" />
                <TextField label="Phone number" value={form.twilio_phone_number} onChange={(value) => setField("twilio_phone_number", value)} />
                <Field label="Number type">
                  <select className={inputClassName} value={form.twilio_number_type} onChange={(event) => setField("twilio_number_type", event.target.value)}>
                    <option value="">—</option>
                    <option value="toll_free">Toll-Free</option>
                    <option value="local">Local</option>
                  </select>
                </Field>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input type="checkbox" className="size-4 rounded border-border" checked={form.sms_enabled} onChange={(event) => setField("sms_enabled", event.target.checked)} />
                  SMS enabled
                </label>
              </>
            ) : null}
          </div>
        </Panel>

        <Panel title="Third-Party Integrations">
          {integrations.length ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {integrations.map(([key, entry]) => (
                <span key={key} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm">
                  {integrationName(key, entry)}
                  <button type="button" onClick={() => removeIntegration(key)} className="text-muted hover:text-danger" aria-label={`Remove ${integrationName(key, entry)}`}>×</button>
                </span>
              ))}
            </div>
          ) : (
            <p className="mb-4 text-sm text-muted">No integrations added.</p>
          )}
          <div className="flex gap-2">
            <input className={inputClassName} value={newIntegrationName} onChange={(event) => setNewIntegrationName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addIntegration(); } }} placeholder="Integration name" aria-label="Integration name" />
            <Button type="button" variant="secondary" onClick={addIntegration}>Add</Button>
          </div>
        </Panel>
      </div>

      <Panel title="Notes">
        <Field label="Technical Notes">
          <textarea className={`${inputClassName} min-h-28`} value={form.technical_notes} onChange={(event) => setField("technical_notes", event.target.value)} />
        </Field>
        <p className="mt-3 text-xs text-muted">
          Store operational context only. Do not enter API keys, auth tokens,
          passwords, or other secrets.
        </p>
      </Panel>

      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save technology & services"}
      </Button>
    </form>
  );
}
