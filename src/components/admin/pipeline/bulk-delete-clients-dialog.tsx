"use client";

import { Button } from "@/components/ui";

export function BulkDeleteClientsDialog({
  count,
  open,
  onCancel,
  onConfirm,
  loading,
}: {
  count: number;
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-delete-clients-title"
        className="relative w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl"
      >
        <h2 id="bulk-delete-clients-title" className="font-display text-xl">
          Delete {count} {count === 1 ? "client" : "clients"}?
        </h2>
        <p className="mt-2 text-sm text-muted">
          This will permanently remove the selected clients from the pipeline.
          This action cannot be undone.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-danger hover:bg-danger/90"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading
              ? "Deleting…"
              : `Delete ${count} ${count === 1 ? "Client" : "Clients"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
