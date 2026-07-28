"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { canDeletePortalClientTenant } from "@/lib/admin/platform-tenant-guards";
import { Button, Panel } from "@/components/ui";

type DeleteClientPanelProps = {
  tenantId: string;
  slug: string;
  displayName: string;
  platformCategory: string;
};

export function DeleteClientPanel({
  tenantId,
  slug,
  displayName,
  platformCategory,
}: DeleteClientPanelProps) {
  const router = useRouter();
  const eligibility = canDeletePortalClientTenant({
    slug,
    platformCategory,
  });

  const [open, setOpen] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!eligibility.allowed) {
    return (
      <Panel title="Delete client">
        <p className="text-sm text-muted">{eligibility.reason}</p>
      </Panel>
    );
  }

  async function onDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/clients/${tenantId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmSlug }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not delete client.");
        return;
      }
      router.push("/admin/clients");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel title="Delete client">
      <p className="text-sm text-muted">
        Remove <strong className="font-medium text-foreground">{displayName}</strong>{" "}
        from the client portal. Offers, billing records, and portal access for this
        tenant are deleted. The owner&apos;s Signal Works login is kept so they can
        still use other apps (for example DAWG or MA5).
      </p>

      {!open ? (
        <Button
          type="button"
          variant="secondary"
          className="mt-4 border-red-200 text-danger hover:bg-red-50"
          onClick={() => setOpen(true)}
        >
          Delete client…
        </Button>
      ) : (
        <div className="mt-4 space-y-3 rounded-lg border border-border bg-background p-4">
          <p className="text-sm">
            Type <span className="font-mono text-foreground">{slug}</span> to confirm.
          </p>
          <input
            type="text"
            value={confirmSlug}
            onChange={(e) => setConfirmSlug(e.target.value)}
            className="w-full max-w-md rounded-md border border-border bg-surface px-3 py-2 text-sm"
            placeholder={slug}
            autoComplete="off"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="border-red-200 text-danger hover:bg-red-50"
              disabled={loading || confirmSlug !== slug}
              onClick={() => void onDelete()}
            >
              {loading ? "Deleting…" : "Delete client"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={loading}
              onClick={() => {
                setOpen(false);
                setConfirmSlug("");
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>
      )}
    </Panel>
  );
}
