"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import type { PipelineClientInput } from "@/lib/pipeline/validation";
import type { PipelineStatus } from "@/lib/pipeline/types";
import { PipelineStatusSelect } from "./pipeline-status-select";
import { PipelineTagsSelect } from "./pipeline-tags-select";

const EMPTY_FORM: PipelineClientInput = {
  business_name: "",
  contact_name: "",
  contact_email: "",
  phone: "",
  website_url: "",
  status: "potential",
  last_conversation: "",
  plan: "",
  estimated_monthly_value: null,
  last_contact_date: "",
  last_contact_date_explicit: false,
  health_check_sent: false,
  tags: [],
};

const inputClassName =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm";

export function ClientPipelineForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: Partial<PipelineClientInput>;
  submitLabel: string;
  onSubmit: (data: PipelineClientInput) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}) {
  const [form, setForm] = useState<PipelineClientInput>({
    ...EMPTY_FORM,
    ...initial,
    contact_email: initial?.contact_email ?? "",
    phone: initial?.phone ?? "",
    website_url: initial?.website_url ?? "",
    last_conversation: initial?.last_conversation ?? "",
    plan: initial?.plan ?? "",
    estimated_monthly_value: initial?.estimated_monthly_value ?? null,
    last_contact_date: initial?.last_contact_date ?? "",
    last_contact_date_explicit: false,
    health_check_sent: initial?.health_check_sent ?? false,
    tags: initial?.tags ?? [],
  });
  const [error, setError] = useState<string | null>(null);

  function updateField<K extends keyof PipelineClientInput>(
    key: K,
    value: PipelineClientInput[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">
        Contact / Business
      </p>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Business Name</span>
        <input
          value={form.business_name}
          onChange={(e) => updateField("business_name", e.target.value)}
          placeholder="MA5 Performance"
          className={inputClassName}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Contact Name</span>
        <input
          value={form.contact_name}
          onChange={(e) => updateField("contact_name", e.target.value)}
          placeholder="John Smith"
          className={inputClassName}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Contact Email</span>
          <input
            type="email"
            value={form.contact_email ?? ""}
            onChange={(e) => updateField("contact_email", e.target.value)}
            placeholder="owner@business.com"
            className={inputClassName}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Phone</span>
          <input
            type="tel"
            value={form.phone ?? ""}
            onChange={(e) => updateField("phone", e.target.value)}
            placeholder="(555) 555-0100"
            className={inputClassName}
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Website</span>
        <input
          type="url"
          value={form.website_url ?? ""}
          onChange={(e) => updateField("website_url", e.target.value)}
          placeholder="https://example.com"
          className={inputClassName}
        />
      </label>

      <p className="pt-2 text-xs font-semibold tracking-wide text-muted uppercase">
        Pipeline
      </p>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Status</span>
        <PipelineStatusSelect
          value={form.status as PipelineStatus}
          onChange={(status) => updateField("status", status)}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Est. Monthly Value (USD)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.estimated_monthly_value ?? ""}
            onChange={(e) =>
              updateField(
                "estimated_monthly_value",
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
            placeholder="2500"
            className={inputClassName}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Last Contact</span>
          <input
            type="date"
            value={form.last_contact_date ?? ""}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                last_contact_date: e.target.value,
                last_contact_date_explicit: true,
              }))
            }
            className={inputClassName}
          />
        </label>
      </div>

      <label className="flex items-start gap-3 rounded-md border border-border px-3 py-3">
        <input
          type="checkbox"
          checked={form.health_check_sent}
          onChange={(e) => updateField("health_check_sent", e.target.checked)}
          className="mt-0.5 size-4 rounded border-border"
        />
        <span>
          <span className="block text-sm font-medium">Health Check Sent</span>
          <span className="mt-0.5 block text-xs text-muted">
            Mark this when a Signal Works Website Health Check has been sent to
            this prospect.
          </span>
        </span>
      </label>

      <p className="pt-2 text-xs font-semibold tracking-wide text-muted uppercase">
        Tags
      </p>
      <label className="block space-y-1.5">
        <span className="sr-only">Tags</span>
        <PipelineTagsSelect
          value={form.tags}
          onChange={(tags) => updateField("tags", tags)}
        />
      </label>

      <p className="pt-2 text-xs font-semibold tracking-wide text-muted uppercase">
        Activity
      </p>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Last Conversation</span>
        <textarea
          value={form.last_conversation ?? ""}
          onChange={(e) => updateField("last_conversation", e.target.value)}
          placeholder="Summarize the most recent call, text, or email..."
          rows={4}
          className={inputClassName}
        />
        <p className="text-xs text-muted">
          Saving new conversation notes updates Last Contact automatically
          unless you choose a date above.
        </p>
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Plan / Next Step</span>
        <textarea
          value={form.plan ?? ""}
          onChange={(e) => updateField("plan", e.target.value)}
          placeholder="Follow up Friday with pricing options..."
          rows={3}
          className={inputClassName}
        />
      </label>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
