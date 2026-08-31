"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function PublicProposalAcceptance({ token, recipientName, recipientEmail, requiresTerms, requiresSow, proposalOnly }: {
  token: string; recipientName: string; recipientEmail: string; requiresTerms: boolean; requiresSow: boolean; proposalOnly: boolean;
}) {
  const [name, setName] = useState(recipientName);
  const [terms, setTerms] = useState(false);
  const [sow, setSow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  async function accept() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/public/proposals/${token}/accept`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acceptedName: name, acceptTerms: terms, acceptSow: sow }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not accept proposal.");
      if (data.checkoutUrl) { window.location.assign(data.checkoutUrl); return; }
      setAccepted(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not accept proposal."); }
    finally { setBusy(false); }
  }
  if (accepted) return <p className="text-sm font-medium text-success">Proposal accepted. Thank you.</p>;
  return <div className="space-y-3">
    <p className="text-sm text-muted">Acceptance applies to this proposal once. Billing {proposalOnly ? "will be handled separately" : "continues through secure Stripe Checkout"}.</p>
    {requiresTerms ? <label className="flex gap-2 text-sm"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /> I agree to the Terms of Service.</label> : null}
    {requiresSow ? <label className="flex gap-2 text-sm"><input type="checkbox" checked={sow} onChange={(e) => setSow(e.target.checked)} /> I agree to the Statement of Work.</label> : null}
    <div className="grid gap-3 md:grid-cols-2"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" className="rounded-md border border-border bg-background px-3 py-2 text-sm" /><input value={recipientEmail} readOnly aria-label="Recipient email" className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted" /></div>
    <Button type="button" disabled={busy || name.trim().length < 2 || (requiresTerms && !terms) || (requiresSow && !sow)} onClick={() => void accept()}>{busy ? "Saving acceptance…" : proposalOnly ? "Accept Proposal" : "Accept & Continue to Payment"}</Button>
    {error ? <p className="text-sm text-danger">{error}</p> : null}
  </div>;
}
