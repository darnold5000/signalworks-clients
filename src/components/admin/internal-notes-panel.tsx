"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Panel } from "@/components/ui";
import type { Client } from "@/lib/types";

export function InternalNotesPanel({ client }: { client: Client }) {
  const router = useRouter();
  const [notes, setNotes] = useState(client.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveNotes() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/clients/${client.id}/portal-settings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: notes.trim() || null }),
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Could not save notes.");
        return;
      }
      setMessage("Saved.");
      router.refresh();
    } catch {
      setError("Could not save notes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Internal notes">
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        rows={3}
        maxLength={5000}
        placeholder="Add an internal note…"
        aria-label="Internal notes"
        className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <div aria-live="polite">
          {error ? <p className="text-xs text-danger">{error}</p> : null}
          {message ? <p className="text-xs text-muted">{message}</p> : null}
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={saving || notes === (client.notes ?? "")}
          onClick={() => void saveNotes()}
        >
          {saving ? "Saving…" : "Save notes"}
        </Button>
      </div>
    </Panel>
  );
}
