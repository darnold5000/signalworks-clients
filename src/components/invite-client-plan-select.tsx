"use client";

import type { PlatformPlanTemplate } from "@/lib/catalog/types";
import { formatMoney } from "@/lib/utils";

export function InviteClientPlanSelect({
  plans,
  selectedPlanKey,
  monthlyPriceDollars,
  onSelectPlan,
  onMonthlyPriceChange,
}: {
  plans: PlatformPlanTemplate[];
  selectedPlanKey: string | null;
  monthlyPriceDollars: string;
  onSelectPlan: (plan: PlatformPlanTemplate) => void;
  onMonthlyPriceChange: (value: string) => void;
}) {
  return (
    <section className="space-y-4">
      <header>
        <h3 className="text-sm font-medium">Plan</h3>
        <p className="mt-1 text-sm text-muted">
          Choose a tier and adjust the monthly amount for this client.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        {plans.map((plan) => {
          const selected = selectedPlanKey === plan.plan_key;
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => onSelectPlan(plan)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                selected
                  ? "border-foreground bg-background"
                  : "border-border hover:border-foreground/40"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="block">
                  <span className="block font-medium">{plan.name}</span>
                  {plan.description ? (
                    <span className="mt-1 block text-sm text-muted">
                      {plan.description}
                    </span>
                  ) : null}
                </span>
                <span className="text-sm text-muted">
                  {formatMoney(plan.default_price_cents)}/mo
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <label className="block max-w-xs space-y-1.5">
        <span className="text-sm font-medium">Monthly price (USD)</span>
        <input
          type="number"
          min="0"
          step="0.01"
          required
          value={monthlyPriceDollars}
          onChange={(e) => onMonthlyPriceChange(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm"
        />
      </label>
    </section>
  );
}
