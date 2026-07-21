"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { PLAN_KEYS, PLANS } from "@/lib/plans";

export function InviteClientForm() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [planKey, setPlanKey] = useState<(typeof PLAN_KEYS)[number]>("launch-website");
  const [domain, setDomain] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    message: string;
    clientId: string;
    inviteLink: string | null;
    inviteMethod: string;
  } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/invite-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          fullName,
          email,
          planKey,
          domain,
          websiteUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail =
          data.details?.fieldErrors &&
          Object.entries(data.details.fieldErrors as Record<string, string[]>)
            .map(([field, messages]) =>
              messages?.length ? `${field}: ${messages[0]}` : null,
            )
            .filter(Boolean)
            .join(" · ");
        setError(detail || data.error || "Invite failed");
        return;
      }
      setResult({
        message: data.message,
        clientId: data.clientId,
        inviteLink: data.inviteLink,
        inviteMethod: data.inviteMethod,
      });
      setBusinessName("");
      setFullName("");
      setEmail("");
      setDomain("");
      setWebsiteUrl("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-muted">
        Creates the client record, assigns one plan, and invites them to set
        their own password. You never see or store their password.
      </p>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Business name</span>
        <input
          required
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Contact name (optional)</span>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Client email</span>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Plan</span>
        <select
          value={planKey}
          onChange={(e) =>
            setPlanKey(e.target.value as (typeof PLAN_KEYS)[number])
          }
          className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm"
        >
          {PLANS.map((plan) => (
            <option key={plan.key} value={plan.key}>
              {plan.name} — ${(plan.monthlyPriceCents / 100).toFixed(2)}/mo
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Domain (optional)</span>
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Website URL (optional)</span>
          <input
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm"
          />
        </label>
      </div>

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
          <a
            href={`/admin/clients/${result.clientId}/overview`}
            className="inline-flex text-sm font-medium underline underline-offset-2"
          >
            Open client record →
          </a>
        </div>
      ) : null}

      <Button type="submit" disabled={loading}>
        {loading ? "Inviting…" : "Invite client"}
      </Button>
    </form>
  );
}
