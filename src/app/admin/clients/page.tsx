import { InviteClientForm } from "@/components/invite-client-form";
import { AdminClientsTable } from "@/components/admin/admin-clients-table";
import { PageHeader, Panel } from "@/components/ui";
import { getAdminClientList } from "@/lib/admin/client-records";
import { computeMrrCents } from "@/lib/data";
import { formatMoney } from "@/lib/utils";

export default async function AdminClientsPage() {
  const clients = await getAdminClientList();
  const mrr = computeMrrCents(clients);
  const active = clients.filter((c) => c.status === "active").length;
  const pastDue = clients.filter(
    (c) => c.subscription_status === "past_due",
  ).length;

  return (
    <>
      <PageHeader
        title="Clients"
        description="Search, filter, and manage Signal Works client tenants."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Panel>
          <p className="text-xs tracking-wide text-muted uppercase">
            Monthly recurring revenue
          </p>
          <p className="mt-2 font-display text-3xl">{formatMoney(mrr)}</p>
        </Panel>
        <Panel>
          <p className="text-xs tracking-wide text-muted uppercase">
            Active clients
          </p>
          <p className="mt-2 font-display text-3xl">{active}</p>
        </Panel>
        <Panel>
          <p className="text-xs tracking-wide text-muted uppercase">
            Failed / past due
          </p>
          <p className="mt-2 font-display text-3xl">{pastDue}</p>
        </Panel>
      </div>

      <Panel title="Invite a client" className="mb-6">
        <InviteClientForm />
      </Panel>

      <Panel title="All clients">
        <AdminClientsTable clients={clients} />
      </Panel>
    </>
  );
}
