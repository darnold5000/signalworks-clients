"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import type { PipelineClientInput } from "@/lib/pipeline/validation";
import type { PipelineStatus } from "@/lib/pipeline/types";
import { PipelineStatusSelect } from "./pipeline-status-select";

const EMPTY_FORM: PipelineClientInput = {
  business_name: "",
  contact_name: "",
  status: "potential",
  last_conversation: "",
  plan: "",
};

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
    last_conversation: initial?.last_conversation ?? "",
    plan: initial?.plan ?? "",
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
          className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Contact Name</span>
        <input
          required
          value={form.contact_name}
          onChange={(e) => updateField("contact_name", e.target.value)}
          placeholder="John Smith"
          className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Status</span>
        <PipelineStatusSelect
          value={form.status as PipelineStatus}
          onChange={(status) => updateField("status", status)}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Last Conversation</span>
        <textarea
          value={form.last_conversation ?? ""}
          onChange={(e) => updateField("last_conversation", e.target.value)}
          placeholder="Summarize the most recent call, text, or email..."
          rows={4}
          className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Plan / Next Step</span>
        <textarea
          value={form.plan ?? ""}
          onChange={(e) => updateField("plan", e.target.value)}
          placeholder="Follow up Friday with pricing options..."
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm"
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