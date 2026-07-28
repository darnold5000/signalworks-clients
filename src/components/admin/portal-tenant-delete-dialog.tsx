"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { canDeletePortalClientTenant } from "@/lib/admin/platform-tenant-guards";
import { Button } from "@/components/ui";

export function PortalTenantDeleteDialog({
  open,
  tenantId,
  slug,
  displayName,
  platformCategory = "services",
  onClose,
}: {
  open: boolean;
  tenantId: string;
  slug: string;
  displayName: string;
  platformCategory?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const eligibility = canDeletePortalClientTenant({ slug, platformCategory });
  const [confirmSlug, setConfirmSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function onDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/clients/${tenantId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmSlug }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not delete client.");
        return;
      }
      onClose();
      router.push("/admin/clients");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl"
      >
        <h2 className="font-display text-xl">Delete client?</h2>
        {!eligibility.allowed ? (
          <p className="mt-2 text-sm text-muted">{eligibility.reason}</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">
              Remove <strong className="text-foreground">{displayName}</strong>{" "}
              from the client portal. Auth login is kept for other apps.
            </p>
            <p className="mt-3 text-sm">
              Type <span className="font-mono">{slug}</span> to confirm.
            </p>
            <input
              type="text"
              value={confirmSlug}
              onChange={(e) => setConfirmSlug(e.target.value)}
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              autoComplete="off"
            />
            {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
          </>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          {eligibility.allowed ? (
            <Button
              type="button"
              variant="secondary"
              className="border-red-200 text-danger hover:bg-red-50"
              disabled={loading || confirmSlug !== slug}
              onClick={() => void onDelete()}
            >
              {loading ? "Deleting…" : "Delete"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
