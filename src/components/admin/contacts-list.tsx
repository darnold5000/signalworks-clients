import type { TenantContact } from "@/lib/database/phase1-types";
import { Panel, StatusPill } from "@/components/ui";

export function ContactsList({ contacts }: { contacts: TenantContact[] }) {
  if (contacts.length === 0) {
    return (
      <Panel title="Contacts">
        <p className="text-sm text-muted">
          No contacts on file. Add contacts when editing this client in a future
          update.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Contacts">
      <ul className="divide-y divide-border">
        {contacts.map((contact) => (
          <li key={contact.id} className="flex flex-col gap-2 py-4 first:pt-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{contact.name}</p>
              <StatusPill label={contact.contact_type} tone="neutral" />
              {contact.is_primary ? (
                <StatusPill label="Primary" tone="success" />
              ) : null}
              {contact.is_billing_contact ? (
                <StatusPill label="Billing" tone="warning" />
              ) : null}
              {contact.is_technical_contact ? (
                <StatusPill label="Technical" tone="warning" />
              ) : null}
            </div>
            {contact.job_title ? (
              <p className="text-sm text-muted">{contact.job_title}</p>
            ) : null}
            <div className="text-sm text-muted">
              {contact.email ? <p>{contact.email}</p> : null}
              {contact.phone ? <p>{contact.phone}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
