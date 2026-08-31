"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

type ContactDraft = {
  name: string;
  email: string;
  phone: string;
  jobTitle: string;
  isPrimary: boolean;
  receivesProposals: boolean;
  receivesBilling: boolean;
  receivesNotifications: boolean;
};

const newContact = (primary = false): ContactDraft => ({
  name: "",
  email: "",
  phone: "",
  jobTitle: "",
  isPrimary: primary,
  receivesProposals: true,
  receivesBilling: primary,
  receivesNotifications: primary,
});

export function CreateClientForm({ onSaved }: { onSaved?: () => void }) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [domain, setDomain] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [status, setStatus] = useState<"prospect" | "active" | "inactive">("prospect");
  const [contacts, setContacts] = useState<ContactDraft[]>([newContact(true)]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateContact(index: number, patch: Partial<ContactDraft>) {
    setContacts((current) => current.map((contact, row) => {
      if (row !== index) return patch.isPrimary ? { ...contact, isPrimary: false } : contact;
      return { ...contact, ...patch };
    }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, websiteUrl, domain, businessPhone, status, contacts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create client.");
      onSaved?.();
      router.push(data.redirectTo);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create client.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm"><span className="mb-1 block text-muted">Business name</span><input required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2" /></label>
        <label className="text-sm"><span className="mb-1 block text-muted">Client status</span><select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-full rounded-md border border-border bg-background px-3 py-2"><option value="prospect">Prospect</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        <label className="text-sm"><span className="mb-1 block text-muted">Website URL (optional)</span><input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2" /></label>
        <label className="text-sm"><span className="mb-1 block text-muted">Domain (optional)</span><input value={domain} onChange={(e) => setDomain(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2" /></label>
        <label className="text-sm"><span className="mb-1 block text-muted">Business phone (optional)</span><input value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2" /></label>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between"><div><h3 className="font-medium">Contacts</h3><p className="text-xs text-muted">Contacts receive only the communications you select. Portal access is granted separately.</p></div><Button type="button" variant="secondary" onClick={() => setContacts((rows) => [...rows, newContact(false)])}>+ Add contact</Button></div>
        {contacts.map((contact, index) => (
          <fieldset key={index} className="rounded-lg border border-border p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm"><span className="mb-1 block text-muted">Name</span><input required value={contact.name} onChange={(e) => updateContact(index, { name: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2" /></label>
              <label className="text-sm"><span className="mb-1 block text-muted">Email</span><input required type="email" value={contact.email} onChange={(e) => updateContact(index, { email: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2" /></label>
              <label className="text-sm"><span className="mb-1 block text-muted">Phone (optional)</span><input value={contact.phone} onChange={(e) => updateContact(index, { phone: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2" /></label>
              <label className="text-sm"><span className="mb-1 block text-muted">Role / title (optional)</span><input value={contact.jobTitle} onChange={(e) => updateContact(index, { jobTitle: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2" /></label>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <label><input type="checkbox" checked={contact.isPrimary} onChange={(e) => updateContact(index, { isPrimary: e.target.checked })} /> Primary contact</label>
              <label><input type="checkbox" checked={contact.receivesProposals} onChange={(e) => updateContact(index, { receivesProposals: e.target.checked })} /> Proposal recipient</label>
              <label><input type="checkbox" checked={contact.receivesBilling} onChange={(e) => updateContact(index, { receivesBilling: e.target.checked })} /> Billing recipient</label>
              <label><input type="checkbox" checked={contact.receivesNotifications} onChange={(e) => updateContact(index, { receivesNotifications: e.target.checked })} /> General notifications</label>
            </div>
            <button type="button" className="mt-3 text-xs text-danger" onClick={() => setContacts((rows) => rows.filter((_, row) => row !== index))}>Remove contact</button>
          </fieldset>
        ))}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={busy}>{busy ? "Creating client…" : "Create client"}</Button>
    </form>
  );
}
