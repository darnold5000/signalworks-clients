import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/portal/print-button";
import { MetaRow, PageHeader, Panel } from "@/components/ui";
import { getPrimaryClient } from "@/lib/data";
import { getPurchaseWithItems } from "@/lib/purchases/service";
import { formatDate, formatMoney } from "@/lib/utils";

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ purchaseId: string }>;
}) {
  const client = await getPrimaryClient();
  if (!client) notFound();

  const { purchaseId } = await params;
  const bundle = await getPurchaseWithItems(purchaseId);
  if (!bundle || bundle.purchase.tenant_id !== client.id) notFound();

  const { purchase, items } = bundle;
  const annualSetupPending =
    purchase.checkout_state === "monthly_complete" ||
    (purchase.checkout_state === "failed" &&
      Boolean(purchase.annual_checkout_session_id) &&
      (purchase.annual_recurring_total_cents ?? 0) > 0);

  return (
    <>
      <PageHeader
        title="Purchase summary"
        description={
          purchase.purchased_at
            ? `Purchased ${formatDate(purchase.purchased_at)}`
            : `Checkout started ${formatDate(purchase.created_at)}`
        }
        actions={
          <Link
            href="/purchases"
            className="inline-flex rounded-md border border-border px-4 py-2.5 text-sm font-medium"
          >
            ← All purchases
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Summary">
          <dl>
            <MetaRow label="Status" value={purchase.status} />
            {annualSetupPending ? (
              <MetaRow
                label="Checkout progress"
                value="Monthly billing active; annual setup required"
              />
            ) : null}
            <MetaRow
              label="Due at checkout"
              value={formatMoney(
                purchase.amount_due_today_cents,
                purchase.currency,
              )}
            />
            <MetaRow
              label="Monthly recurring"
              value={formatMoney(
                purchase.recurring_total_cents,
                purchase.currency,
              )}
            />
            {(purchase.annual_recurring_total_cents ?? 0) > 0 ? (
              <MetaRow
                label="Annual recurring"
                value={
                  annualSetupPending
                    ? `Pending setup · ${formatMoney(
                        purchase.annual_recurring_total_cents ?? 0,
                        purchase.currency,
                      )}/year contracted`
                    : `${formatMoney(
                        purchase.annual_recurring_total_cents ?? 0,
                        purchase.currency,
                      )}/year`
                }
              />
            ) : null}
            <MetaRow
              label="Discounts"
              value={formatMoney(
                purchase.discount_total_cents,
                purchase.currency,
              )}
            />
          </dl>
        </Panel>

        <Panel title="Line items">
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="py-3 text-sm">
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-muted">
                  {item.billing_type}
                  {item.billing_interval ? ` / ${item.billing_interval}` : ""} ·{" "}
                  {item.service_status}
                </p>
                <p className="mt-1 font-medium">
                  {formatMoney(
                    item.unit_amount_cents * item.quantity,
                    purchase.currency,
                  )}
                  {item.billing_type === "recurring"
                    ? item.billing_interval === "year"
                      ? "/year"
                      : "/month"
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Printable summary" className="mt-6">
        <p className="text-sm text-muted">
          Use your browser print dialog to save this purchase summary as a PDF.
        </p>
        <div className="mt-4">
          <PrintButton />
        </div>
      </Panel>
    </>
  );
}
