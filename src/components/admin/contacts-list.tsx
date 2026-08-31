"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TenantContact } from "@/lib/database/phase1-types";
import { Button, Panel, StatusPill } from "@/components/ui";

type Draft = { name: string; email: string; phone: string; jobTitle: string; isPrimary: boolean; receivesProposals: boolean; receivesBilling: boolean; receivesNotifications: boolean };
function draft(contact?: TenantContact): Draft {
  return { name: contact?.name ?? "", email: contact?.email ?? "", phone: contact?.phone ?? "", jobTitle: contact?.job_title ?? "", isPrimary: contact?.is_primary ?? false, receivesProposals: contact?.receives_proposals ?? false, receivesBilling: contact?.receives_billing ?? contact?.is_billing_contact ?? false, receivesNotifications: contact?.receives_notifications ?? false };
}

export function ContactsList({ tenantId, contacts }: { tenantId: string; contacts: TenantContact[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Draft>(draft());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true); setError(null); setMessage(null);
    try {
      const isNew = editing === "new";
      const res = await fetch(isNew ? `/api/admin/clients/${tenantId}/contacts` : `/api/admin/clients/${tenantId}/contacts/${editing}`, { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save contact.");
      setEditing(null); setForm(draft()); setMessage(isNew ? "Contact added." : "Contact updated."); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save contact."); }
    finally { setBusy(false); }
  }
  async function remove(contact: TenantContact) {
    if (!window.confirm(`Remove ${contact.name} from this client's contacts? This does not delete any auth user or customer data.`)) return;
    const res = await fetch(`/api/admin/clients/${tenantId}/contacts/${contact.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Could not remove contact."); return; }
    router.refresh();
  }
  async function invite(contact: TenantContact) {
    setBusy(true); setError(null); setMessage(null);
    try {
      const res = await fetch(`/api/admin/clients/${tenantId}/portal-invite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: contact.id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not grant portal access.");
      setMessage(`${data.message}${data.inviteLink ? `\n${data.inviteLink}` : ""}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not grant portal access."); }
    finally { setBusy(false); }
  }
  function editor() {
    return <div className="space-y-3 rounded-lg border border-border bg-background p-4">
      <div className="grid gap-3 md:grid-cols-2"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className="rounded-md border border-border bg-surface px-3 py-2" /><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="rounded-md border border-border bg-surface px-3 py-2" /><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="rounded-md border border-border bg-surface px-3 py-2" /><input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} placeholder="Role / title" className="rounded-md border border-border bg-surface px-3 py-2" /></div>
      <div className="flex flex-wrap gap-4 text-sm"><label><input type="checkbox" checked={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })} /> Primary</label><label><input type="checkbox" checked={form.receivesProposals} onChange={(e) => setForm({ ...form, receivesProposals: e.target.checked })} /> Proposals</label><label><input type="checkbox" checked={form.receivesBilling} onChange={(e) => setForm({ ...form, receivesBilling: e.target.checked })} /> Billing</label><label><input type="checkbox" checked={form.receivesNotifications} onChange={(e) => setForm({ ...form, receivesNotifications: e.target.checked })} /> Notifications</label></div>
      <div className="flex gap-2"><Button type="button" disabled={busy || !form.name.trim() || !form.email.trim()} onClick={() => void save()}>Save contact</Button><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button></div>
    </div>;
  }
  return <Panel title="Contacts">
    <div className="mb-4 flex items-center justify-between"><p className="text-sm text-muted">Contact recipients and portal users are separate. Grant portal access only when needed.</p><Button type="button" onClick={() => { setForm(draft()); setEditing("new"); }}>Add contact</Button></div>
    {editing === "new" ? editor() : null}
    {contacts.length === 0 && editing !== "new" ? <p className="text-sm text-muted">No contacts on file.</p> : <ul className="divide-y divide-border">{contacts.map((contact) => <li key={contact.id} className="py-4">
      {editing === contact.id ? editor() : <><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{contact.name}</p>{contact.is_primary ? <StatusPill label="Primary" tone="success" /> : null}{contact.receives_proposals ? <StatusPill label="Proposal recipient" tone="neutral" /> : null}{(contact.receives_billing ?? contact.is_billing_contact) ? <StatusPill label="Billing recipient" tone="warning" /> : null}{contact.receives_notifications ? <StatusPill label="Notifications" tone="neutral" /> : null}</div><p className="mt-1 text-sm text-muted">{contact.job_title ? `${contact.job_title} · ` : ""}{contact.email}{contact.phone ? ` · ${contact.phone}` : ""}</p><div className="mt-3 flex flex-wrap gap-3 text-xs"><button type="button" onClick={() => { setForm(draft(contact)); setEditing(contact.id); }}>Edit</button>{contact.email ? <button type="button" disabled={busy} onClick={() => void invite(contact)}>Send Portal Invite</button> : null}<button type="button" className="text-danger" onClick={() => void remove(contact)}>Remove</button></div></>}
    </li>)}</ul>}
    {message ? <p className="mt-4 whitespace-pre-wrap text-sm text-success">{message}</p> : null}{error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
  </Panel>;
}
