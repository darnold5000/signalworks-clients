"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function ManageBillingButton({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not open billing portal");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={openPortal} disabled={loading}>
        {loading ? "Opening…" : "Manage Billing"}
      </Button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
