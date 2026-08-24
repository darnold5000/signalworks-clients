import type { ClientOffer, ClientOfferItem } from "@/lib/database/phase1-types";
import { buildOfferPricingSummary } from "@/lib/offers/pricing-summary";
import { OfferPricingSummaryView } from "@/components/portal/offer-pricing-summary";
import {
  resolveIncludedSetupLines,
  resolveOneTimeServiceLines,
  resolvePaidRecurringAddOnLines,
  resolvePlanInclusionLines,
} from "@/lib/offers/invoice-sections";
import { formatMoney } from "@/lib/utils";
import type { Client } from "@/lib/types";

export function ProposalCommercialSummary({
  offer,
  items,
  planInclusions,
  setupInclusions,
}: {
  offer: Pick<ClientOffer, "currency" | "title">;
  items: ClientOfferItem[];
  planInclusions?: Client["plan_inclusions"];
  setupInclusions?: Client["setup_inclusions"];
}) {
  const pricing = buildOfferPricingSummary(items, offer.currency);
  const planInclusionLines = planInclusions?.map((name, index) => ({
    id: `stored-plan-inclusion-${index}`,
    name,
  })) ?? resolvePlanInclusionLines(items);
  const includedSetup = setupInclusions?.map((name, index) => ({
    id: `stored-setup-inclusion-${index}`,
    name,
  })) ?? resolveIncludedSetupLines(items);
  const paidAddOns = resolvePaidRecurringAddOnLines(items);
  const oneTimeLines = resolveOneTimeServiceLines(items);

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-medium">Plan</h3>
        <div className="mt-2 flex items-baseline justify-between gap-4 text-sm">
          <span className="font-medium">{pricing.planName}</span>
          <span>
            {formatMoney(pricing.baseMonthlyAmountCents, offer.currency)}/month
          </span>
        </div>
      </section>

      {planInclusionLines.length > 0 ? (
        <section>
          <h3 className="text-sm font-medium">Included with your plan</h3>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {planInclusionLines.map((line) => (
              <li key={line.id} className="flex justify-between gap-4">
                <span>{line.name}</span>
                <span className="shrink-0 text-xs">Included</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {includedSetup.length > 0 ? (
        <section>
          <h3 className="text-sm font-medium">Included setup</h3>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {includedSetup.map((line) => (
              <li key={line.id} className="flex justify-between gap-4">
                <span>{line.name}</span>
                <span className="shrink-0 text-xs">$0 — Included</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {paidAddOns.length > 0 ? (
        <section>
          <h3 className="text-sm font-medium">Paid add-ons</h3>
          <ul className="mt-2 divide-y divide-border">
            {paidAddOns.map((item) => (
              <li
                key={item.id}
                className="flex justify-between gap-4 py-2 text-sm"
              >
                <span>{item.name}</span>
                <span className="font-medium">
                  {formatMoney(item.amountCents, offer.currency)}/mo
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {oneTimeLines.length > 0 ? (
        <section>
          <h3 className="text-sm font-medium">One-time services</h3>
          <ul className="mt-2 divide-y divide-border">
            {oneTimeLines.map((item) => (
              <li
                key={item.id}
                className="flex justify-between gap-4 py-2 text-sm"
              >
                <span>{item.name}</span>
                <span className="font-medium">
                  {formatMoney(item.amountCents, offer.currency)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h3 className="text-sm font-medium">Pricing summary</h3>
        <OfferPricingSummaryView summary={pricing} />
      </section>
    </div>
  );
}

/** @deprecated use invoice section helpers */
export function isProposalEntitlementLine(item: ClientOfferItem): boolean {
  return item.item_type === "product";
}
