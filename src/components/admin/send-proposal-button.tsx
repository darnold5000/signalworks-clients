"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import type { ClientOfferStatus, TenantContact } from "@/lib/database/phase1-types";
import { proposalCanBeSent, proposalSendDisabledReason, proposalSendLabel } from "@/lib/admin/proposal-send-policy";

export function SendProposalButton({ tenantId, offerId, offerStatus, contacts }: {
  tenantId: string;
  offerId: string;
  offerStatus: ClientOfferStatus;
  contacts: TenantContact[];
}) {
  const router = useRouter();
  const eligible = contacts.filter((contact) => Boolean(contact.email));
  const [selected, setSelected] = useState<string[]>(() => {
    const defaults = eligible.filter((contact) => contact.receives_proposals).map((contact) => contact.id);
    return defaults.length > 0 ? defaults : eligible.filter((contact) => contact.is_primary).map((contact) => contact.id);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ message: string; deliveries: Array<{ email: string; name: string; deliveryStatus: string; portalLink: string | null; error: string | null }> } | null>(null);
  const disabled = !proposalCanBeSent(offerStatus);

  async function onSend() {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`/api/admin/clients/${tenantId}/offers/${offerId}/send`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactIds: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send proposal.");
      setResult(data);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send proposal.");
    } finally { setLoading(false); }
  }

  return <div className="space-y-3">
    {!disabled ? <fieldset className="space-y-2 rounded-lg border border-border p-3">
      <legend className="px-1 text-sm font-medium">Send proposal to</legend>
      {eligible.length === 0 ? <p className="text-sm text-muted">Add a contact with an email address before sending.</p> : eligible.map((contact) => <label key={contact.id} className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={selected.includes(contact.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, contact.id] : current.filter((id) => id !== contact.id))} />
        <span>{contact.name} — {contact.email}</span>
        {contact.receives_proposals ? <span className="text-xs text-muted">Default recipient</span> : null}
      </label>)}
    </fieldset> : null}
    <Button type="button" variant="secondary" disabled={loading || disabled || selected.length === 0} onClick={() => void onSend()}>{loading ? "Sending…" : proposalSendLabel(offerStatus)}</Button>
    <p className="text-xs text-muted">{disabled ? proposalSendDisabledReason(offerStatus) : "Each selected contact receives a separate email with private access to this one proposal. Contacts are not granted portal login access."}</p>
    {error ? <p className="text-sm text-danger">{error}</p> : null}
    {result ? <div className="space-y-2 rounded-lg border border-border p-3 text-sm"><p className="text-success">{result.message}</p>{result.deliveries.map((delivery) => <div key={delivery.email}><p>{delivery.name} · {delivery.email} · {delivery.deliveryStatus.replace("_", " ")}</p>{delivery.error ? <p className="text-danger">{delivery.error}</p> : null}{delivery.portalLink ? <textarea readOnly value={delivery.portalLink} className="mt-1 h-20 w-full rounded-md border border-border bg-surface p-2 text-xs" /> : null}</div>)}</div> : null}
  </div>;
}
