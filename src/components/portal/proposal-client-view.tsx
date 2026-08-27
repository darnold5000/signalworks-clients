import type {
  ClientOffer,
  ClientOfferFeature,
  ClientOfferItem,
} from "@/lib/database/phase1-types";
import {
  calculateAmountDueFirstCycle,
  calculateOfferTotals,
} from "@/lib/offers/calculate-totals";
import {
  formatClientDiscountAmountLabel,
  formatClientDiscountDurationNote,
  formatClientDiscountSecondaryNote,
  groupProposalInvestmentItems,
  proposalInvestmentHasDiscountLines,
  proposalInvestmentHasLineItems,
} from "@/lib/offers/proposal-investment-display";
import { formatMoney } from "@/lib/utils";
import { resolveOfferBillingMethod } from "@/lib/offers/billing-method";
import {
  cadenceAggregateLabel,
  cadenceDescription,
  cadenceKey,
  cadenceSuffix,
} from "@/lib/offers/billing-cadence";

function itemDiscountCents(item: ClientOfferItem): number {
  const original = item.unit_amount_cents * item.quantity;
  if (item.discount_type === "amount" && item.discount_amount_cents) {
    return Math.min(original, item.discount_amount_cents);
  }
  if (item.discount_type === "percent" && item.discount_percent) {
    return Math.round((original * Number(item.discount_percent)) / 100);
  }
  return 0;
}

function billingLabel(item: ClientOfferItem): string {
  if (item.billing_type === "one_time") return "One-time";
  return cadenceDescription(item);
}

function BillableInvestmentRow({
  item,
  currency,
}: {
  item: ClientOfferItem;
  currency: string;
}) {
  const original = item.unit_amount_cents * item.quantity;
  const discount = itemDiscountCents(item);
  const finalPrice = original - discount;

  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="font-medium">{item.name}</p>
        {item.description ? (
          <p className="mt-1 text-sm text-muted">{item.description}</p>
        ) : null}
        <p className="mt-1 text-xs text-muted">{billingLabel(item)}</p>
      </div>
      <div className="text-left sm:text-right">
        {discount > 0 ? (
          <>
            <p className="text-xs text-muted line-through">
              {formatMoney(original, currency)}
            </p>
            <p className="text-xs text-success">
              Save {formatMoney(discount, currency)}
            </p>
          </>
        ) : null}
        <p className="font-semibold">
          {formatMoney(finalPrice, currency)}
          {item.billing_type === "recurring"
            ? cadenceSuffix(item)
            : ""}
        </p>
      </div>
    </div>
  );
}

function DiscountInvestmentRow({
  item,
  currency,
  cadenceItem,
}: {
  item: ClientOfferItem;
  currency: string;
  cadenceItem?: ClientOfferItem;
}) {
  const durationNote = formatClientDiscountDurationNote(item);
  const secondaryNote = formatClientDiscountSecondaryNote(item);

  return (
    <div
      className="flex flex-col gap-2 border-l-2 border-success/25 bg-success/5 px-4 py-3 pl-5 sm:flex-row sm:items-start sm:justify-between"
    >
      <div>
        <p className="text-sm font-medium text-foreground">{item.name}</p>
        {durationNote ? (
          <p className="mt-0.5 text-xs text-muted">{durationNote}</p>
        ) : null}
        {secondaryNote ? (
          <p className="mt-0.5 text-xs text-muted/80">{secondaryNote}</p>
        ) : null}
      </div>
      <p className="text-sm font-semibold text-success sm:text-right">
        {formatClientDiscountAmountLabel(item, currency, cadenceItem)}
      </p>
    </div>
  );
}

export function ProposalClientView({
  offer,
  items,
  features,
  preview = false,
  acceptance,
}: {
  offer: ClientOffer;
  items: ClientOfferItem[];
  features: ClientOfferFeature[];
  preview?: boolean;
  acceptance?: React.ReactNode;
}) {
  const totals = calculateOfferTotals(items);
  const investmentLayout = groupProposalInvestmentItems(items);
  const hasInvestmentLines = proposalInvestmentHasLineItems(investmentLayout);
  const hasDiscountLines = proposalInvestmentHasDiscountLines(investmentLayout);
  const dueToday = calculateAmountDueFirstCycle(totals);
  const planInclusions = offer.plan_inclusions ?? [];
  const setupInclusions = offer.setup_inclusions ?? [];
  const proposalOnly = resolveOfferBillingMethod(offer) === "proposal_only";
  const recurringItems = investmentLayout.groups
    .map((group) => group.billable)
    .filter((item) => item.billing_type === "recurring");
  const recurringCadences = new Set(recurringItems.map(cadenceKey));
  const sharedRecurringCadence = recurringCadences.size === 1 ? recurringItems[0] : null;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <header className="border-b border-border bg-foreground px-6 py-8 text-white sm:px-10">
        <p className="text-xs font-semibold tracking-[0.22em] text-white/70 uppercase">
          Signal Works Digital
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-3xl tracking-tight sm:text-5xl">
          {offer.title}
        </h1>
        {offer.short_summary ? (
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/80">
            {offer.short_summary}
          </p>
        ) : null}
      </header>

      <div className="space-y-10 px-6 py-8 sm:px-10 sm:py-10">
        {offer.description ? (
          <section>
            <h2 className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">
              Overview
            </h2>
            <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground">
              {offer.description}
            </div>
          </section>
        ) : null}

        {features.length > 0 ? (
          <section>
            <h2 className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">
              What&apos;s Included
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {features.map((feature) => (
                <li key={feature.id} className="flex gap-3 text-sm leading-6">
                  <span className="mt-0.5 text-success" aria-hidden="true">
                    ✓
                  </span>
                  <span>{feature.label}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {planInclusions.length > 0 ? (
          <section>
            <h2 className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">
              Included with This Plan
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {planInclusions.map((inclusion) => (
                <li key={inclusion} className="flex gap-3 text-sm leading-6">
                  <span className="mt-0.5 text-success" aria-hidden="true">
                    ✓
                  </span>
                  <span>{inclusion}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {setupInclusions.length > 0 ? (
          <section>
            <h2 className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">
              Included Setup
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {setupInclusions.map((inclusion) => (
                <li key={inclusion} className="flex gap-3 text-sm leading-6">
                  <span className="mt-0.5 text-success" aria-hidden="true">
                    ✓
                  </span>
                  <span>{inclusion}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h2 className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">
            Investment
          </h2>
          <div className="mt-4 divide-y divide-border rounded-xl border border-border">
            {hasInvestmentLines ? (
              <>
                {investmentLayout.groups.map((group) => (
                  <div key={group.billable.id}>
                    <BillableInvestmentRow
                      item={group.billable}
                      currency={offer.currency}
                    />
                    {group.discounts.map((discount) => (
                      <DiscountInvestmentRow
                        key={discount.id}
                        item={discount}
                        currency={offer.currency}
                        cadenceItem={group.billable}
                      />
                    ))}
                  </div>
                ))}
                {investmentLayout.orphanDiscounts.map((discount) => (
                  <DiscountInvestmentRow
                    key={discount.id}
                    item={discount}
                    currency={offer.currency}
                  />
                ))}
              </>
            ) : (
              <p className="p-4 text-sm text-muted">
                Pricing has not been added yet.
              </p>
            )}
          </div>

          {hasInvestmentLines ? (
            <dl
              className={`mt-5 ml-auto max-w-md space-y-2 text-sm ${
                hasDiscountLines ? "border-t border-border pt-4" : ""
              }`}
            >
              <div className="flex justify-between gap-6">
                <dt className="text-muted">One-time</dt>
                <dd className="font-medium">
                  {formatMoney(totals.initial_total_cents, offer.currency)}
                </dd>
              </div>
              {sharedRecurringCadence ? (
                <div className="flex justify-between gap-6">
                  <dt className="text-muted">{cadenceAggregateLabel(sharedRecurringCadence)}</dt>
                  <dd className="font-medium">
                    {formatMoney(totals.recurring_total_cents, offer.currency)}{cadenceSuffix(sharedRecurringCadence)}
                  </dd>
                </div>
              ) : recurringItems.length > 0 ? (
                <div className="space-y-1 border-t border-border pt-2">
                  <dt className="text-muted">Recurring charges</dt>
                  {recurringItems.map((item) => (
                    <dd key={item.id} className="flex justify-between gap-6">
                      <span>{item.name}</span>
                      <span className="font-medium">{formatMoney(item.unit_amount_cents * item.quantity, offer.currency)}{cadenceSuffix(item)}</span>
                    </dd>
                  ))}
                </div>
              ) : null}
              <div className="flex justify-between gap-6 border-t border-border pt-3 text-base">
                {proposalOnly ? (
                  <>
                    <dt className="font-semibold">Billing</dt>
                    <dd className="font-semibold">Handled separately</dd>
                  </>
                ) : (
                  <>
                    <dt className="font-semibold">Due today</dt>
                    <dd className="font-semibold">
                      {formatMoney(dueToday, offer.currency)}
                    </dd>
                  </>
                )}
              </div>
            </dl>
          ) : null}
        </section>

        {hasInvestmentLines ? (
          <section className="rounded-xl bg-background p-4 text-sm text-muted">
            <h2 className="font-medium text-foreground">Proposal terms</h2>
            <p className="mt-2 leading-6">
              {proposalOnly
                ? "Billing will be handled separately. No payment or Stripe billing change occurs when this proposal is accepted."
                : "One-time charges are due at checkout. Recurring services renew at the billing frequency shown above until canceled under the applicable agreement."}
            </p>
            {offer.requires_terms_acceptance ? (
              <p className="mt-2 leading-6">
                Acceptance of the applicable Terms of Service and Statement of
                Work is required before {proposalOnly ? "acceptance" : "payment"}.
              </p>
            ) : null}
          </section>
        ) : null}

        <section>
          <h2 className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">
            {proposalOnly ? "Acceptance" : "Acceptance & Checkout"}
          </h2>
          <div className="mt-4">
            {preview ? (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled
                  className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white opacity-50"
                >
                  {proposalOnly
                    ? "Accept Proposal (disabled in preview mode)"
                    : "Checkout disabled in preview mode"}
                </button>
                <p className="text-xs text-muted">
                  Previewing does not accept, publish, send, or create billing.
                </p>
              </div>
            ) : (
              acceptance
            )}
          </div>
        </section>
      </div>
    </article>
  );
}
