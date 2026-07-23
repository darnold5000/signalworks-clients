"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function OfferCheckoutButton({
  label = "Continue to secure checkout",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/portal/offer/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403 && data.error?.includes("terms")) {
          router.push("/offer");
          return;
        }
        setError(data.error ?? "Could not start checkout");
        return;
      }
      if (data.url) window.location.assign(data.url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <Button type="button" onClick={startCheckout} disabled={loading}>
        {loading ? "Redirecting to Stripe…" : label}
      </Button>
      {error ? (
        <p className="mt-2 text-sm text-muted">
          {error}{" "}
          <a href="/offer" className="underline underline-offset-2">
            Review your proposal
          </a>
        </p>
      ) : null}
    </div>
  );
}
