"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import {
  REQUEST_TYPE_LABELS,
  type RequestType,
} from "@/lib/types";

const TYPES = Object.keys(REQUEST_TYPE_LABELS) as RequestType[];

export function RequestForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [requestType, setRequestType] = useState<RequestType>("text_change");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    setLoading(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: clientId,
          requestType,
          title,
          description,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not submit request");
        return;
      }
      setOk(true);
      setTitle("");
      setDescription("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">What would you like changed?</span>
        <select
          value={requestType}
          onChange={(e) => setRequestType(e.target.value as RequestType)}
          className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm"
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {REQUEST_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Short title</span>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Details</span>
        <textarea
          required
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm"
        />
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {ok ? (
        <p className="text-sm text-success">Request submitted. We’ll take it from here.</p>
      ) : null}
      <Button type="submit" disabled={loading}>
        {loading ? "Submitting…" : "Submit request"}
      </Button>
    </form>
  );
}
