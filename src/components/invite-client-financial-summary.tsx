"use client";

import type {
  InviteCommercialExtras,
  InvitePlanSelection,
  InviteProductSelection,
} from "@/lib/catalog/build-invite-offer";
import { calculateInviteOfferTotals } from "@/lib/catalog/build-invite-offer";
import { calculateAmountDueFirstCycle } from "@/lib/offers/calculate-totals";
import { formatMoney } from "@/lib/utils";

export function InviteClientFinancialSummary({
  plan,
  products,
  extras,
}: {
  plan: InvitePlanSelection | null;
  products: InviteProductSelection[];
  extras?: InviteCommercialExtras;
}) {
  if (!plan) {
    return (
      <aside className="rounded-xl border border-border bg-surface p-4">
        <h3 className="font-medium">Financial summary</h3>
        <p className="mt-2 text-sm text-muted">Select a plan to preview totals.</p>
      </aside>
    );
  }

  const totals = calculateInviteOfferTotals({ plan, products, extras });
  const arr = totals.recurring_total_cents * 12;
  const dueFirstCycle = calculateAmountDueFirstCycle(totals);
  const monthlyDiscountCents = extras?.monthly_discount_cents ?? 0;
  const paidAddOnCount = extras?.paid_add_ons?.length ?? 0;

  return (
    <aside className="rounded-xl border border-border bg-surface p-4">
      <h3 className="font-medium">Financial summary</h3>
      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex items-start justify-between gap-4">
          <dt className="text-muted">Selected plan</dt>
          <dd className="text-right font-medium">{plan.name}</dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="text-muted">Recurring subtotal</dt>
          <dd>{formatMoney(totals.subtotal_cents)}</dd>
        </div>
        {monthlyDiscountCents > 0 ? (
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted">Monthly discount</dt>
            <dd>-{formatMoney(monthlyDiscountCents)}</dd>
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-4 border-t border-border pt-3 font-medium">
          <dt>Final MRR</dt>
          <dd>{formatMoney(totals.recurring_total_cents)}</dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="text-muted">ARR</dt>
          <dd>{formatMoney(arr)}</dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="text-muted">One-time charges</dt>
          <dd>{formatMoney(totals.initial_total_cents)}</dd>
        </div>
        <div className="flex items-start justify-between gap-4 border-t border-border pt-3 font-medium">
          <dt>Due at first billing cycle</dt>
          <dd>{formatMoney(dueFirstCycle)}</dd>
        </div>
      </dl>
      {products.length > 0 || paidAddOnCount > 0 ? (
        <p className="mt-4 text-xs text-muted">
          {products.length > 0
            ? `${products.length} bundled product${products.length === 1 ? "" : "s"} included. `
            : ""}
          {paidAddOnCount > 0
            ? `${paidAddOnCount} paid add-on${paidAddOnCount === 1 ? "" : "s"} selected.`
            : ""}
        </p>
      ) : null}
    </aside>
  );
}
