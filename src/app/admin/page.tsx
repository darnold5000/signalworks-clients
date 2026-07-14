import Link from "next/link";
import { PageHeader, Panel, StatusPill } from "@/components/ui";
import { computeMrrCents, getAccessibleClients } from "@/lib/data";
import { formatMoney, monthlyMarginCents } from "@/lib/utils";

export default async function AdminHomePage() {
  const clients = await getAccessibleClients();
  const mrr = computeMrrCents(clients);
  const active = clients.filter((c) => c.status === "active").length;
  const pastDue = clients.filter(
    (c) => c.subscription_status === "past_due",
  ).length;

  return (
    <>
      <PageHeader
        title="Clients"
        description="Operating view across Signal Works managed websites."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Panel>
          <p className="text-xs tracking-wide text-muted uppercase">MRR</p>
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

      <Panel title="All clients">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs tracking-wide text-muted uppercase">
                <th className="pb-3 font-medium">Client</th>
                <th className="pb-3 font-medium">Plan</th>
                <th className="pb-3 font-medium">Price</th>
                <th className="pb-3 font-medium">Stripe</th>
                <th className="pb-3 font-medium">Margin</th>
                <th className="pb-3 font-medium">Site</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const margin = monthlyMarginCents(
                  c.monthly_price_cents,
                  c.estimated_infra_cost_cents,
                );
                return (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="py-3">
                      <Link
                        href={`/admin/clients/${c.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {c.business_name}
                      </Link>
                      <p className="text-xs text-muted">{c.domain}</p>
                    </td>
                    <td className="py-3">{c.plan_name}</td>
                    <td className="py-3">
                      {formatMoney(c.monthly_price_cents, c.currency)}
                    </td>
                    <td className="py-3">
                      <StatusPill
                        label={c.subscription_status.replace("_", " ")}
                        tone={
                          c.subscription_status === "active"
                            ? "success"
                            : c.subscription_status === "past_due"
                              ? "danger"
                              : "warning"
                        }
                      />
                    </td>
                    <td className="py-3">{formatMoney(margin)}</td>
                    <td className="py-3">
                      <StatusPill
                        label={c.website_status}
                        tone={
                          c.website_status === "live" ? "success" : "warning"
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
