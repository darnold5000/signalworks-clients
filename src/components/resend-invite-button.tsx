"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

type ResendInviteButtonProps = {
  tenantId: string;
  ownerEmail?: string | null;
};

export function ResendInviteButton({
  tenantId,
  ownerEmail,
}: ResendInviteButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    message: string;
    inviteLink: string | null;
    email: string;
  } | null>(null);

  async function onResend() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/admin/resend-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        inviteLink?: string | null;
        email?: string;
      };

      if (!res.ok) {
        setError(data.error ?? "Could not resend invite.");
        return;
      }

      setResult({
        message: data.message ?? "Invite resent.",
        inviteLink: data.inviteLink ?? null,
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
          disabled={loading}
          onClick={() => void onResend()}
        >
          {loading ? "Sending…" : "Resend invite"}
        </Button>
        {ownerEmail ? (
          <p className="text-sm text-muted">Portal email: {ownerEmail}</p>
        ) : null}
      </div>

      <p className="text-xs text-muted">
        Generates a fresh single-use link. Ask the client to open it in a
        private window, or sign out of your admin session before testing the
        link yourself.
      </p>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {result ? (
        <div className="space-y-2 rounded-lg border border-border bg-background p-4 text-sm">
          <p className="text-success">{result.message}</p>
          {result.inviteLink ? (
            <div className="space-y-1">
              <p className="font-medium">Invite link (send privately):</p>
              <textarea
                readOnly
                value={result.inviteLink}
                className="h-24 w-full rounded-md border border-border bg-surface p-2 text-xs"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
