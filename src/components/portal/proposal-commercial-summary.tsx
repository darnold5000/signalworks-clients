import type { ClientOffer, ClientOfferItem } from "@/lib/database/phase1-types";
import {
  catalogProductDisplayName,
  offerItemProductKey,
} from "@/lib/catalog/display-names";
import { groupIncludedPlatformItems } from "@/lib/offers/included-platform-summary";
import {
  isBundledProductItem,
  isPaidAddOnItem,
} from "@/lib/offers/offer-item-metadata";
import { buildOfferPricingSummary } from "@/lib/offers/pricing-summary";
import { OfferPricingSummaryView } from "@/components/portal/offer-pricing-summary";
import { formatMoney } from "@/lib/utils";

export function ProposalCommercialSummary({
  offer,
  items,
}: {
  offer: Pick<ClientOffer, "currency" | "title">;
  items: ClientOfferItem[];
}) {
  const pricing = buildOfferPricingSummary(items, offer.currency);
  const includedGroups = groupIncludedPlatformItems(items);
  const paidAddOns = items.filter(
    (item) =>
      item.is_selected &&
      isPaidAddOnItem(item) &&
      item.item_type !== "discount",
  );
  const oneTimeLines = items.filter(
    (item) =>
      item.is_selected &&
      item.billing_type === "one_time" &&
      item.item_type !== "discount" &&
      item.item_type !== "credit",
  );

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-medium">Plan</h3>
        <div className="mt-2 flex items-baseline justify-between gap-4 text-sm">
          <span className="font-medium">{pricing.planName}</span>
          <span>
            {formatMoney(
              pricing.standardMonthlyAmountAfterDiscountCents,
              offer.currency,
            )}
            /month
          </span>
        </div>
      </section>

      {includedGroups.length > 0 ? (
        <section>
          <h3 className="text-sm font-medium">Included platform</h3>
          <p className="mt-2 text-sm text-muted">
            Included with your plan at no additional charge.
          </p>
          <ul className="mt-3 space-y-3 text-sm">
            {includedGroups.map((group) => (
              <li key={group.sectionKey}>
                <p className="font-medium text-foreground">{group.sectionLabel}</p>
                <p className="mt-1 text-muted">
                  {group.itemNames.join(", ")}
                </p>
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
                <span>
                  {catalogProductDisplayName(
                    offerItemProductKey(item.metadata),
                    item.name,
                  )}
                </span>
                <span className="font-medium">
                  {formatMoney(
                    item.unit_amount_cents * item.quantity,
                    offer.currency,
                  )}
                  /mo
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
                <span>{item.description || item.name}</span>
                <span className="font-medium">
                  {formatMoney(
                    item.unit_amount_cents * item.quantity,
                    offer.currency,
                  )}
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

/** @deprecated use groupIncludedPlatformItems — kept for tests */
export function isProposalEntitlementLine(item: ClientOfferItem): boolean {
  return isBundledProductItem(item);
}
