import Link from "next/link";
import { notFound } from "next/navigation";
import { ResendInviteButton } from "@/components/resend-invite-button";
import {
  MetaRow,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/ui";
import { getTenantOwnerInviteTarget } from "@/lib/admin/client-invite-link";
import { isPlatformAdmin } from "@/lib/auth";
import {
  getClientById,
  getRequestsForClient,
} from "@/lib/data";
import {
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
} from "@/lib/types";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  monthlyMarginCents,
} from "@/lib/utils";
import {
  createClient,
  createServiceClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export default async function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClientById(id);
  if (!client) notFound();

  const requests = await getRequestsForClient(client.id);
  const margin = monthlyMarginCents(
    client.monthly_price_cents,
    client.estimated_infra_cost_cents,
  );
  const lastRequest = requests[0];

  let ownerEmail: string | null = null;
  let ownerHasSignedIn = false;
  let ownerFound = false;
  const showPortalAccess =
    isSupabaseConfigured() && (await isPlatformAdmin());

  if (showPortalAccess) {
    const supabase = await createClient();
    const owner = await getTenantOwnerInviteTarget(supabase, client.id, {
      checkSignIn: isServiceRoleConfigured()
        ? createServiceClient()
        : undefined,
    });
    ownerFound = Boolean(owner);
    ownerEmail = owner?.email ?? null;
    ownerHasSignedIn = owner?.hasSignedIn ?? false;
  }

  return (
    <>
      <PageHeader
        title={client.business_name}
        description="Full operating record for this managed website."
        actions={
          <Link
            href="/admin"
            className="text-sm text-muted underline-offset-2 hover:underline"
          >
            ← All clients
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Account">
          <dl>
            <MetaRow
              label="Status"
              value={
                <StatusPill
                  label={client.status}
                  tone={client.status === "active" ? "success" : "warning"}
                />
              }
            />
            <MetaRow
              label="Website"
              value={
                <StatusPill
                  label={client.website_status}
                  tone={
                    client.website_status === "live" ? "success" : "warning"
                  }
                />
              }
            />
            <MetaRow label="Plan" value={client.plan_name} />
            <MetaRow
              label="Price"
              value={formatMoney(
                client.monthly_price_cents,
                client.currency,
              )}
            />
            <MetaRow
              label="Intro expires"
              value={formatDate(client.intro_expires_on)}
            />
            <MetaRow
              label="Contract start"
              value={formatDate(client.contract_start_on)}
            />
            <MetaRow
              label="Last request"
              value={lastRequest?.title ?? "—"}
            />
          </dl>
        </Panel>

        <Panel title="Infrastructure & margin">
          <dl>
            <MetaRow label="Domain owner" value={client.domain_owner ?? "—"} />
            <MetaRow label="Registrar" value={client.registrar ?? "—"} />
            <MetaRow
              label="Hosting"
              value={client.hosting_platform ?? "—"}
            />
            <MetaRow
              label="Database"
              value={client.database_platform ?? "—"}
            />
            <MetaRow
              label="Stripe subscription"
              value={
                <StatusPill
                  label={client.subscription_status.replace("_", " ")}
                  tone={
                    client.subscription_status === "active"
                      ? "success"
                      : "warning"
                  }
                />
              }
            />
            <MetaRow
              label="Est. monthly infra"
              value={formatMoney(client.estimated_infra_cost_cents)}
            />
            <MetaRow label="Monthly margin" value={formatMoney(margin)} />
          </dl>
        </Panel>

        {showPortalAccess ? (
          <Panel title="Portal access" className="lg:col-span-2">
            {!ownerFound ? (
              <p className="text-sm text-muted">
                No portal owner is linked to this client yet. Use{" "}
                <strong>Invite client</strong> on the admin home page, or check
                tenant membership in Supabase.
              </p>
            ) : ownerHasSignedIn ? (
              <p className="text-sm text-muted">
                {ownerEmail} has signed in to the portal. Use Supabase password
                recovery if they need a new password.
              </p>
            ) : (
              <ResendInviteButton
                tenantId={client.id}
                ownerEmail={ownerEmail}
              />
            )}
          </Panel>
        ) : null}

        <Panel title="Notes" className="lg:col-span-2">
          <p className="text-sm whitespace-pre-wrap text-muted">
            {client.notes ?? "No notes yet."}
          </p>
          <div className="mt-4 grid gap-2 text-xs text-muted sm:grid-cols-3">
            <p>Customer: {client.stripe_customer_id ?? "—"}</p>
            <p>Subscription: {client.stripe_subscription_id ?? "—"}</p>
            <p>Price: {client.stripe_price_id ?? "—"}</p>
          </div>
        </Panel>

        <Panel title="Service requests" className="lg:col-span-2">
          {requests.length === 0 ? (
            <p className="text-sm text-muted">No requests.</p>
          ) : (
            <ul className="space-y-3">
              {requests.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-1 border-b border-border pb-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{r.title}</p>
                    <p className="text-xs text-muted">
                      {REQUEST_TYPE_LABELS[r.request_type]} ·{" "}
                      {formatDateTime(r.created_at)}
                    </p>
                  </div>
                  <StatusPill
                    label={REQUEST_STATUS_LABELS[r.status]}
                    tone={
                      r.status === "completed"
                        ? "success"
                        : r.status === "waiting_on_client"
                          ? "warning"
                          : "neutral"
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
