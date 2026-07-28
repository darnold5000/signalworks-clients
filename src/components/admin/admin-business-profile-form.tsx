"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Panel } from "@/components/ui";
import {
  INTERNAL_STATUS_LABELS,
  ONBOARDING_STATUS_LABELS,
} from "@/lib/admin/labels";
import type {
  TenantInternalStatus,
  TenantProfile,
} from "@/lib/database/phase1-types";
import type { Client } from "@/lib/types";

const INTERNAL_STATUSES = Object.keys(
  INTERNAL_STATUS_LABELS,
) as TenantInternalStatus[];

type FormState = {
  legal_business_name: string;
  display_name: string;
  business_type: string;
  primary_contact_name: string;
  primary_contact_email: string;
  primary_contact_phone: string;
  billing_contact_name: string;
  billing_contact_email: string;
  website_url: string;
  primary_domain: string;
  support_email: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  internal_status: TenantInternalStatus;
};

function toFormState(client: Client, profile: TenantProfile | null): FormState {
  return {
    legal_business_name:
      profile?.legal_business_name ?? client.business_name ?? "",
    display_name: profile?.display_name ?? client.business_name ?? "",
    business_type: profile?.business_type ?? "",
    primary_contact_name: profile?.primary_contact_name ?? "",
    primary_contact_email:
      profile?.primary_contact_email ?? client.support_email ?? "",
    primary_contact_phone:
      profile?.primary_contact_phone ?? client.support_phone ?? "",
    billing_contact_name: profile?.billing_contact_name ?? "",
    billing_contact_email: profile?.billing_contact_email ?? "",
    website_url: profile?.website_url ?? client.website_url ?? "",
    primary_domain: profile?.primary_domain ?? client.domain ?? "",
    support_email: profile?.support_email ?? client.support_email ?? "",
    address_line_1: profile?.address_line_1 ?? "",
    address_line_2: profile?.address_line_2 ?? "",
    city: profile?.city ?? "",
    state: profile?.state ?? "",
    postal_code: profile?.postal_code ?? "",
    country: profile?.country ?? "US",
    internal_status: profile?.internal_status ?? "onboarding",
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="text-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

export function AdminBusinessProfileForm({
  tenantId,
  client,
  profile,
  startEditing = false,
}: {
  tenantId: string;
  client: Client;
  profile: TenantProfile | null;
  startEditing?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(startEditing);
  const [form, setForm] = useState(() => toFormState(client, profile));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/clients/${tenantId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save.");
        return;
      }
      setMessage("Saved.");
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div id="business-profile" className="scroll-mt-8">
      <Panel title="Business information">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {profile?.onboarding_status ? (
            <p className="text-xs text-muted">
              Onboarding: {ONBOARDING_STATUS_LABELS[profile.onboarding_status]}
            </p>
          ) : (
            <span />
          )}
          {!editing ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          ) : null}
        </div>

        {editing ? (
          <form onSubmit={(e) => void onSave(e)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Legal name">
                <input
                  className={inputClass}
                  value={form.legal_business_name}
                  onChange={(e) => set("legal_business_name", e.target.value)}
                />
              </Field>
              <Field label="Display name">
                <input
                  className={inputClass}
                  value={form.display_name}
                  onChange={(e) => set("display_name", e.target.value)}
                />
              </Field>
              <Field label="Business type">
                <input
                  className={inputClass}
                  value={form.business_type}
                  onChange={(e) => set("business_type", e.target.value)}
                />
              </Field>
              <Field label="Internal status">
                <select
                  className={inputClass}
                  value={form.internal_status}
                  onChange={(e) =>
                    set("internal_status", e.target.value as TenantInternalStatus)
                  }
                >
                  {INTERNAL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {INTERNAL_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Primary contact">
                <input
                  className={inputClass}
                  value={form.primary_contact_name}
                  onChange={(e) => set("primary_contact_name", e.target.value)}
                />
              </Field>
              <Field label="Primary email">
                <input
                  type="email"
                  className={inputClass}
                  value={form.primary_contact_email}
                  onChange={(e) => set("primary_contact_email", e.target.value)}
                />
              </Field>
              <Field label="Primary phone">
                <input
                  className={inputClass}
                  value={form.primary_contact_phone}
                  onChange={(e) => set("primary_contact_phone", e.target.value)}
                />
              </Field>
              <Field label="Billing contact">
                <input
                  className={inputClass}
                  value={form.billing_contact_name}
                  onChange={(e) => set("billing_contact_name", e.target.value)}
                />
              </Field>
              <Field label="Billing email">
                <input
                  type="email"
                  className={inputClass}
                  value={form.billing_contact_email}
                  onChange={(e) => set("billing_contact_email", e.target.value)}
                />
              </Field>
              <Field label="Website URL">
                <input
                  className={inputClass}
                  value={form.website_url}
                  onChange={(e) => set("website_url", e.target.value)}
                />
              </Field>
              <Field label="Domain">
                <input
                  className={inputClass}
                  value={form.primary_domain}
                  onChange={(e) => set("primary_domain", e.target.value)}
                />
              </Field>
              <Field label="Support email">
                <input
                  type="email"
                  className={inputClass}
                  value={form.support_email}
                  onChange={(e) => set("support_email", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Address line 1">
              <input
                className={inputClass}
                value={form.address_line_1}
                onChange={(e) => set("address_line_1", e.target.value)}
              />
            </Field>
            <Field label="Address line 2">
              <input
                className={inputClass}
                value={form.address_line_2}
                onChange={(e) => set("address_line_2", e.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="City">
                <input
                  className={inputClass}
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                />
              </Field>
              <Field label="State">
                <input
                  className={inputClass}
                  value={form.state}
                  onChange={(e) => set("state", e.target.value)}
                />
              </Field>
              <Field label="Postal code">
                <input
                  className={inputClass}
                  value={form.postal_code}
                  onChange={(e) => set("postal_code", e.target.value)}
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={saving}
                onClick={() => {
                  setForm(toFormState(client, profile));
                  setEditing(false);
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            {message ? <p className="text-sm text-success">{message}</p> : null}
          </form>
        ) : (
          <dl className="text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-muted">Legal name</dt>
                <dd>{form.legal_business_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Display name</dt>
                <dd>{form.display_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Primary email</dt>
                <dd>{form.primary_contact_email || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Phone</dt>
                <dd>{form.primary_contact_phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Website</dt>
                <dd>{form.website_url || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Status</dt>
                <dd>{INTERNAL_STATUS_LABELS[form.internal_status]}</dd>
              </div>
            </div>
          </dl>
        )}
      </Panel>
    </div>
  );
}
