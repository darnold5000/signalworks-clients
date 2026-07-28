"use client";

import type {
  InviteCommercialExtras,
  InvitePlanSelection,
  InviteProductSelection,
} from "@/lib/catalog/build-invite-offer";
import { calculateInviteOfferTotals } from "@/lib/catalog/build-invite-offer";
import { calculateAmountDueFirstCycle } from "@/lib/offers/calculate-totals";
import { formatMoney } from "@/lib/utils";

function recurringAddOnCents(extras?: InviteCommercialExtras): number {
  let total = 0;
  for (const addOn of extras?.paid_add_ons ?? []) {
    if (addOn.billing_type === "one_time") continue;
    total += addOn.unit_amount_cents * Math.max(1, addOn.quantity ?? 1);
  }
  for (const custom of extras?.custom_service_add_ons ?? []) {
    if (custom.billing_type === "one_time") continue;
    total += custom.unit_amount_cents * Math.max(1, custom.quantity ?? 1);
  }
  return total;
}

export function InviteClientFinancialSummary({
  plan,
  products,
  extras,
  className,
}: {
  plan: InvitePlanSelection | null;
  products: InviteProductSelection[];
  extras?: InviteCommercialExtras;
  className?: string;
}) {
  if (!plan) {
    return (
      <aside
        className={`rounded-xl border border-border bg-surface p-4 ${className ?? ""}`}
      >
        <h3 className="font-medium">Financial summary</h3>
        <p className="mt-2 text-sm text-muted">Select a plan to preview totals.</p>
      </aside>
    );
  }

  const totals = calculateInviteOfferTotals({ plan, products, extras });
  const planMonthlyCents = plan.monthly_price_cents;
  const addOnMonthlyCents = recurringAddOnCents(extras);
  const arr = totals.recurring_total_cents * 12;
  const dueFirstCycle = calculateAmountDueFirstCycle(totals);
  const monthlyDiscountCents = extras?.monthly_discount_cents ?? 0;
  const discountDurationMonths = extras?.monthly_discount_duration_months ?? 0;
  const paidAddOnCount =
    (extras?.paid_add_ons?.length ?? 0) +
    (extras?.custom_service_add_ons?.length ?? 0);
  const componentCount =
    products.length + (extras?.custom_platform_components?.length ?? 0);

  return (
    <aside
      className={`rounded-xl border border-border bg-surface p-4 ${className ?? ""}`}
    >
      <h3 className="font-medium">Financial summary</h3>
      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex items-start justify-between gap-4">
          <dt className="text-muted">{plan.name}</dt>
          <dd className="text-right font-medium">
            {formatMoney(planMonthlyCents)}/mo
          </dd>
        </div>
        {addOnMonthlyCents > 0 ? (
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted">Recurring add-ons</dt>
            <dd className="text-right">{formatMoney(addOnMonthlyCents)}/mo</dd>
          </div>
        ) : null}
        {addOnMonthlyCents > 0 ? (
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted">Monthly subtotal</dt>
            <dd>{formatMoney(planMonthlyCents + addOnMonthlyCents)}/mo</dd>
          </div>
        ) : null}
        {monthlyDiscountCents > 0 ? (
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted">Monthly discount</dt>
            <dd>
              -{formatMoney(monthlyDiscountCents)}
              {discountDurationMonths > 0
                ? ` for ${discountDurationMonths} mo`
                : " (ongoing)"}
            </dd>
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
      {componentCount > 0 || paidAddOnCount > 0 ? (
        <p className="mt-4 text-xs text-muted">
          {componentCount > 0
            ? `${componentCount} platform component${componentCount === 1 ? "" : "s"} selected. `
            : ""}
          {paidAddOnCount > 0
            ? `${paidAddOnCount} service add-on${paidAddOnCount === 1 ? "" : "s"} selected.`
            : ""}
        </p>
      ) : null}
    </aside>
  );
}
