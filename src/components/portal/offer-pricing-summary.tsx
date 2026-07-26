import { formatMoney } from "@/lib/utils";
import type { OfferPricingSummary } from "@/lib/offers/pricing-summary";

function discountThroughLabel(summary: OfferPricingSummary): string | null {
  if (summary.recurringDiscountAmountCents <= 0) return null;
  if (summary.discountIsPermanent) {
    return `${formatMoney(summary.recurringDiscountAmountCents, summary.currency)}/month ongoing`;
  }
  if (summary.discountDurationMonths) {
    return `${formatMoney(summary.recurringDiscountAmountCents, summary.currency)}/month for ${summary.discountDurationMonths} month${summary.discountDurationMonths === 1 ? "" : "s"}`;
  }
  return `${formatMoney(summary.recurringDiscountAmountCents, summary.currency)}/month`;
}

export function OfferPricingSummaryView({
  summary,
  compact = false,
}: {
  summary: OfferPricingSummary;
  compact?: boolean;
}) {
  const hasDiscount = summary.recurringDiscountAmountCents > 0;
  const discountLabel = discountThroughLabel(summary);

  return (
    <dl className={`space-y-2 text-sm ${compact ? "" : "mt-2"}`}>
      <div className="flex justify-between gap-4">
        <dt className="text-muted">Standard monthly price</dt>
        <dd className="font-medium text-right">
          {formatMoney(
            summary.standardMonthlyAmountAfterDiscountCents,
            summary.currency,
          )}
        </dd>
      </div>
      {summary.recurringAddOnAmountCents > 0 ? (
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Recurring add-ons</dt>
          <dd className="font-medium text-right">
            {formatMoney(summary.recurringAddOnAmountCents, summary.currency)}
          </dd>
        </div>
      ) : null}
      {hasDiscount && discountLabel ? (
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Introductory discount</dt>
          <dd className="font-medium text-right text-success">
            −{discountLabel}
          </dd>
        </div>
      ) : null}
      {hasDiscount ? (
        <>
          <div className="flex justify-between gap-4 border-t border-border pt-2">
            <dt className="text-muted">Your monthly price</dt>
            <dd className="font-semibold text-right">
              {formatMoney(
                summary.discountedMonthlyAmountCents,
                summary.currency,
              )}
              {summary.discountDurationMonths
                ? ` for the first ${summary.discountDurationMonths} month${summary.discountDurationMonths === 1 ? "" : "s"}`
                : summary.discountIsPermanent
                  ? ""
                  : ""}
            </dd>
          </div>
          {!summary.discountIsPermanent && summary.discountDurationMonths ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Then</dt>
              <dd className="font-medium text-right">
                {formatMoney(
                  summary.standardMonthlyAmountAfterDiscountCents,
                  summary.currency,
                )}
                /month
              </dd>
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex justify-between gap-4 border-t border-border pt-2">
          <dt className="text-muted">Monthly price</dt>
          <dd className="font-semibold text-right">
            {formatMoney(
              summary.discountedMonthlyAmountCents,
              summary.currency,
            )}
          </dd>
        </div>
      )}
      {summary.oneTimeAmountCents > 0 ? (
        <div className="flex justify-between gap-4">
          <dt className="text-muted">One-time charges</dt>
          <dd className="font-medium text-right">
            {formatMoney(summary.oneTimeAmountCents, summary.currency)}
          </dd>
        </div>
      ) : null}
      {!compact ? (
        <div className="flex justify-between gap-4 border-t border-border pt-2">
          <dt className="text-muted">Amount due at checkout</dt>
          <dd className="font-semibold text-right">
            {formatMoney(summary.dueAtCheckoutCents, summary.currency)}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
