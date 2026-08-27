import type { ClientOfferItem } from "@/lib/database/phase1-types";
import {
  DISCOUNT_SCOPE,
  discountScopeFromMetadata,
} from "@/lib/offers/discount-scope";
import { isEntitlementOfferItem } from "@/lib/offers/offer-item-metadata";
import { formatMoney } from "@/lib/utils";
import { cadenceSuffix } from "@/lib/offers/billing-cadence";

export type ProposalInvestmentGroup = {
  billable: ClientOfferItem;
  discounts: ClientOfferItem[];
};

export type ProposalInvestmentLayout = {
  groups: ProposalInvestmentGroup[];
  /** Discount lines with no preceding billable row (unusual). */
  orphanDiscounts: ClientOfferItem[];
};

function isDiscountLine(item: ClientOfferItem): boolean {
  return item.item_type === "discount" || item.item_type === "credit";
}

export function discountLineAmountCents(item: ClientOfferItem): number {
  return item.unit_amount_cents * item.quantity;
}

export function groupProposalInvestmentItems(
  items: ClientOfferItem[],
): ProposalInvestmentLayout {
  const selected = items
    .filter((item) => item.is_selected)
    .sort((a, b) => a.sort_order - b.sort_order);

  const groups: ProposalInvestmentGroup[] = [];
  const orphanDiscounts: ClientOfferItem[] = [];
  let lastGroup: ProposalInvestmentGroup | null = null;

  for (const item of selected) {
    if (isDiscountLine(item)) {
      if (lastGroup) {
        lastGroup.discounts.push(item);
      } else {
        orphanDiscounts.push(item);
      }
      continue;
    }

    if (isEntitlementOfferItem(item)) {
      continue;
    }

    lastGroup = { billable: item, discounts: [] };
    groups.push(lastGroup);
  }

  return { groups, orphanDiscounts };
}

export function formatClientDiscountDurationNote(
  item: ClientOfferItem,
): string | null {
  const scope = discountScopeFromMetadata(item);

  if (scope === DISCOUNT_SCOPE.FIRST_CYCLE) {
    return "First billing cycle";
  }

  if (
    item.discount_duration_type === "repeating" &&
    item.discount_duration_months
  ) {
    const months = item.discount_duration_months;
    return `First ${months} month${months === 1 ? "" : "s"}`;
  }

  if (
    item.discount_duration_type === "forever" ||
    (!item.discount_duration_type && !item.discount_duration_months)
  ) {
    const description = item.description?.trim();
    if (scope === DISCOUNT_SCOPE.RECURRING && description) {
      return null;
    }
    return "Ongoing";
  }

  if (item.discount_duration_type === "once") {
    return "First billing cycle";
  }

  return null;
}

/** Optional subtle copy for forever recurring discounts (e.g. editor description). */
export function formatClientDiscountSecondaryNote(
  item: ClientOfferItem,
): string | null {
  const scope = discountScopeFromMetadata(item);
  const isForever =
    item.discount_duration_type === "forever" ||
    (!item.discount_duration_type && !item.discount_duration_months);

  if (scope !== DISCOUNT_SCOPE.RECURRING || !isForever) {
    return null;
  }

  const description = item.description?.trim();
  return description || null;
}

export function formatClientDiscountAmountLabel(
  item: ClientOfferItem,
  currency: string,
  cadenceItem?: ClientOfferItem,
): string {
  const amount = formatMoney(discountLineAmountCents(item), currency);
  const scope = discountScopeFromMetadata(item);

  if (scope === DISCOUNT_SCOPE.RECURRING) {
    return `-${amount}${cadenceSuffix(cadenceItem ?? item)}`;
  }

  return `-${amount}`;
}

export function proposalInvestmentHasLineItems(layout: ProposalInvestmentLayout): boolean {
  return layout.groups.length > 0 || layout.orphanDiscounts.length > 0;
}

export function proposalInvestmentHasDiscountLines(
  layout: ProposalInvestmentLayout,
): boolean {
  return (
    layout.orphanDiscounts.length > 0 ||
    layout.groups.some((group) => group.discounts.length > 0)
  );
}
