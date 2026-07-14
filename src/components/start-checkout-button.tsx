"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import type { PlanKey } from "@/lib/plans";
import { formatMoney } from "@/lib/utils";

export function StartCheckoutButton({
  clientId,
  planKey,
  planName,
  monthlyPriceCents,
}: {
  clientId: string;
  planKey: PlanKey;
  planName: string;
  monthlyPriceCents: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, planKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not start checkout");
        return;
      }
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={startCheckout} disabled={loading}>
        {loading
          ? "Redirecting…"
          : `Subscribe — ${planName} (${formatMoney(monthlyPriceCents)}/mo)`}
      </Button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
