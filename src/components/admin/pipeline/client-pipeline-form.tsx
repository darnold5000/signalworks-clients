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
  next_follow_up_date: "",
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
    next_follow_up_date: initial?.next_follow_up_date ?? "",
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
    if (!form.business_name.trim()) {
      setError("Business name is required");
      return;
    }
    if (!form.contact_name.trim()) {
      setError("Contact name is required");
      return;
    }
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Business Name</span>
        <input
          required
          value={form.business_name}
          onChange={(e) => updateField("business_name", e.target.value)}
          placeholder="MA5 Performance"
          className={inputClassName}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Contact Name</span>
        <input
          required
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
          <span className="text-sm font-medium">Next Follow-up</span>
          <input
            type="date"
            value={form.next_follow_up_date ?? ""}
            onChange={(e) => updateField("next_follow_up_date", e.target.value)}
            className={inputClassName}
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Tags</span>
        <PipelineTagsSelect
          value={form.tags}
          onChange={(tags) => updateField("tags", tags)}
        />
      </label>

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
          Saving conversation notes updates Last Contacted automatically.
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
