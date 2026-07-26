"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Panel } from "@/components/ui";

export function AdminClientDocumentUpload({
  tenantId,
}: {
  tenantId: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    const form = new FormData();
    form.set("title", title);
    form.set("description", description);
    form.set("file", file);

    try {
      const res = await fetch(`/api/admin/clients/${tenantId}/documents`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }
      setTitle("");
      setDescription("");
      setFile(null);
      setMessage(`Uploaded "${data.document?.title ?? "document"}".`);
      router.refresh();
    } catch {
      setError("Upload failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Upload document for client">
      <p className="text-sm text-muted">
        Files appear on the client&apos;s Documents tab. PDF, images, and
        common Office formats up to 20 MB.
      </p>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={2}
            maxLength={200}
            placeholder="e.g. Brand guidelines"
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Description (optional)</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            placeholder="Short note for the client"
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">File</span>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.doc,.docx,.xls,.xlsx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? "Uploading…" : "Upload to client Documents"}
        </Button>
      </form>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-success">{message}</p> : null}
    </Panel>
  );
}
