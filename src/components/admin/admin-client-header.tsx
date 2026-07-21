import { ResendInviteButton } from "@/components/resend-invite-button";
import { ButtonLink, MetaRow, Panel, StatusPill } from "@/components/ui";
import type { AdminClientBundle } from "@/lib/admin/client-records";
import {
  INTERNAL_STATUS_LABELS,
  ONBOARDING_STATUS_LABELS,
  internalStatusTone,
} from "@/lib/admin/labels";
import { formatDate, formatMoney, monthlyMarginCents } from "@/lib/utils";

export function AdminClientHeader({ bundle }: { bundle: AdminClientBundle }) {
  const { client, profile, owner } = bundle;
  const margin = monthlyMarginCents(
    client.monthly_price_cents,
    client.estimated_infra_cost_cents,
  );
  const internalStatus = profile?.internal_status ?? null;

  return (
    <div className="mb-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl tracking-tight">
              {profile?.display_name ?? client.business_name}
            </h1>
            {internalStatus ? (
              <StatusPill
                label={INTERNAL_STATUS_LABELS[internalStatus]}
                tone={internalStatusTone(internalStatus)}
              />
            ) : (
              <StatusPill label={client.status} tone="warning" />
            )}
          </div>
          <p className="text-sm text-muted">
            {client.slug}
            {client.domain ? ` · ${client.domain}` : ""}
          </p>
          <div className="flex flex-wrap gap-3 text-sm text-muted">
            <span>{client.plan_name}</span>
            <span>
              {formatMoney(client.monthly_price_cents, client.currency)} / mo
            </span>
            <span>Margin {formatMoney(margin)}</span>
            <span>
              Billing{" "}
              <StatusPill
                label={client.subscription_status.replace("_", " ")}
                tone={
                  client.subscription_status === "active"
                    ? "success"
                    : client.subscription_status === "past_due"
                      ? "danger"
                      : "warning"
                }
              />
            </span>
          </div>
          {profile?.onboarding_status ? (
            <p className="text-xs text-muted">
              Onboarding: {ONBOARDING_STATUS_LABELS[profile.onboarding_status]}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/admin/clients" variant="secondary">
            ← All clients
          </ButtonLink>
          {client.website_url ? (
            <ButtonLink href={client.website_url} variant="secondary">
              Open website
            </ButtonLink>
          ) : null}
          {client.stripe_customer_id ? (
            <ButtonLink
              href={`https://dashboard.stripe.com/customers/${client.stripe_customer_id}`}
              variant="secondary"
            >
              Open Stripe
            </ButtonLink>
          ) : null}
        </div>
      </div>

      {owner && !owner.hasSignedIn ? (
        <Panel title="Portal access">
          <ResendInviteButton tenantId={client.id} ownerEmail={owner.email} />
        </Panel>
      ) : null}
    </div>
  );
}

export function BusinessProfilePanel({ bundle }: { bundle: AdminClientBundle }) {
  const { client, profile } = bundle;

  return (
    <Panel title="Business information">
      <dl>
        <MetaRow
          label="Legal name"
          value={profile?.legal_business_name ?? client.business_name}
        />
        <MetaRow label="Display name" value={profile?.display_name ?? "—"} />
        <MetaRow label="Business type" value={profile?.business_type ?? "—"} />
        <MetaRow
          label="Primary contact"
          value={profile?.primary_contact_name ?? "—"}
        />
        <MetaRow
          label="Primary email"
          value={profile?.primary_contact_email ?? client.support_email ?? "—"}
        />
        <MetaRow
          label="Primary phone"
          value={profile?.primary_contact_phone ?? client.support_phone ?? "—"}
        />
        <MetaRow
          label="Billing contact"
          value={profile?.billing_contact_name ?? "—"}
        />
        <MetaRow
          label="Billing email"
          value={profile?.billing_contact_email ?? "—"}
        />
        <MetaRow label="Website" value={profile?.website_url ?? client.website_url ?? "—"} />
        <MetaRow label="Domain" value={profile?.primary_domain ?? client.domain ?? "—"} />
        <MetaRow
          label="Address"
          value={
            profile?.address_line_1
              ? [
                  profile.address_line_1,
                  profile.address_line_2,
                  profile.city,
                  profile.state,
                  profile.postal_code,
                ]
                  .filter(Boolean)
                  .join(", ")
              : "—"
          }
        />
        <MetaRow
          label="Contract start"
          value={formatDate(client.contract_start_on)}
        />
      </dl>
      {!profile ? (
        <p className="mt-4 text-sm text-muted">
          No tenant profile row yet. It will be created when you save business
          details in a later update.
        </p>
      ) : null}
    </Panel>
  );
}

export function InternalNotesPanel({ bundle }: { bundle: AdminClientBundle }) {
  const notes = bundle.internalNotes;
  const legacyNotes = bundle.client.notes;

  return (
    <Panel title="Internal notes">
      {notes.length === 0 && !legacyNotes ? (
        <p className="text-sm text-muted">No internal notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {legacyNotes ? (
            <li className="rounded-lg border border-dashed border-border p-3 text-sm text-muted">
              <p className="text-xs font-medium uppercase tracking-wide">
                Legacy portal note
              </p>
              <p className="mt-1 whitespace-pre-wrap">{legacyNotes}</p>
            </li>
          ) : null}
          {notes.map((note) => (
            <li
              key={note.id}
              className="rounded-lg border border-border bg-background p-3 text-sm"
            >
              <p className="text-xs text-muted">
                {note.subject_type}
                {note.subject_id ? ` · ${note.subject_id.slice(0, 8)}` : ""} ·{" "}
                {formatDate(note.created_at)}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{note.body}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
