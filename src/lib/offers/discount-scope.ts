import type { ClientOfferItem } from "@/lib/database/phase1-types";

export const DISCOUNT_SCOPE = {
  /** Reduces recurring_total_cents (e.g. founding client monthly discount). */
  RECURRING: "recurring",
  /** Reduces first-cycle due only; MRR unchanged. */
  FIRST_CYCLE: "first_cycle",
} as const;

export type DiscountScope =
  (typeof DISCOUNT_SCOPE)[keyof typeof DISCOUNT_SCOPE];

export function discountScopeFromMetadata(
  item: ClientOfferItem,
): DiscountScope {
  const scope = item.metadata?.discount_scope;
  if (scope === DISCOUNT_SCOPE.RECURRING) return DISCOUNT_SCOPE.RECURRING;
  return DISCOUNT_SCOPE.FIRST_CYCLE;
}

export function recurringMonthlyDiscountMetadata(): {
  discount_scope: typeof DISCOUNT_SCOPE.RECURRING;
} {
  return { discount_scope: DISCOUNT_SCOPE.RECURRING };
}

export function firstCycleDiscountMetadata(): {
  discount_scope: typeof DISCOUNT_SCOPE.FIRST_CYCLE;
} {
  return { discount_scope: DISCOUNT_SCOPE.FIRST_CYCLE };
}
