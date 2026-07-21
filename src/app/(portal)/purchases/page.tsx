import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui";
import { getPrimaryClient } from "@/lib/data";
import { listPurchasesForTenant } from "@/lib/purchases/service";
import { formatDate, formatMoney } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function PurchasesPage() {
  const client = await getPrimaryClient();
  if (!client) notFound();

  const purchases = await listPurchasesForTenant(client.id);

  return (
    <>
      <PageHeader
        title="Purchases"
        description="Everything you have purchased through Signal Works."
      />

      <Panel>
        {purchases.length === 0 ? (
          <p className="text-sm text-muted">No purchases yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {purchases.map((purchase) => (
              <li
                key={purchase.id}
                className="flex flex-col gap-2 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {formatMoney(
                      purchase.amount_due_today_cents,
                      purchase.currency,
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDate(purchase.created_at)} · {purchase.status}
                  </p>
                </div>
                <Link
                  href={`/purchases/${purchase.id}`}
                  className="text-sm font-medium underline underline-offset-2"
                >
                  View purchase
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
