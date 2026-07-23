"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function SendProposalButton({
  tenantId,
  offerId,
  offerStatus,
  ownerEmail,
}: {
  tenantId: string;
  offerId: string;
  offerStatus: string;
  ownerEmail?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    message: string;
    portalLink: string | null;
    email: string;
  } | null>(null);

  const disabled = offerStatus !== "published";

  async function onSend() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(
        `/api/admin/clients/${tenantId}/offers/${offerId}/send`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not send proposal.");
        return;
      }

      setResult({
        message: data.message,
        portalLink: data.portalLink ?? null,
        email: data.email ?? ownerEmail ?? "",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={loading || disabled}
          onClick={() => void onSend()}
        >
          {loading ? "Sending…" : "Send proposal to client"}
        </Button>
        {ownerEmail ? (
          <p className="text-sm text-muted">Portal email: {ownerEmail}</p>
        ) : null}
      </div>

      {disabled ? (
        <p className="text-xs text-muted">
          Publish the offer first, then send it. Existing clients sign in to
          review — this does not create a new account.
        </p>
      ) : (
        <p className="text-xs text-muted">
          Emails a link to review this proposal. Clients who already have a
          password get a sign-in link; new portal users get a one-time setup
          link.
        </p>
      )}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {result ? (
        <div className="space-y-2 rounded-lg border border-border bg-background p-4 text-sm">
          <p className="text-success">{result.message}</p>
          {result.portalLink ? (
            <textarea
              readOnly
              value={result.portalLink}
              className="h-24 w-full rounded-md border border-border bg-surface p-2 text-xs"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
