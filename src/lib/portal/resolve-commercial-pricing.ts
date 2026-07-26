import type { ClientOfferItem, Purchase } from "@/lib/database/phase1-types";
import { getActiveOfferForTenant } from "@/lib/offers/queries";
import {
  buildOfferPricingSummary,
  type OfferPricingSummary,
} from "@/lib/offers/pricing-summary";
import { listPurchasesForTenant } from "@/lib/purchases/service";
import type { Client } from "@/lib/types";

type PurchaseSnapshot = {
  items?: ClientOfferItem[];
  offer?: { currency?: string };
};

function summaryFromSnapshot(
  snapshot: PurchaseSnapshot | null | undefined,
  fallbackCurrency: string,
): OfferPricingSummary | null {
  const items = snapshot?.items;
  if (!items?.length) return null;
  return buildOfferPricingSummary(
    items,
    snapshot?.offer?.currency ?? fallbackCurrency,
  );
}

/**
 * Resolves customer-facing monthly pricing from the active offer (pre-purchase)
 * or the latest purchase snapshot (post-purchase). Falls back to portal settings.
 */
export async function resolveCommercialPricing(
  client: Client,
): Promise<OfferPricingSummary | null> {
  const activeOffer = await getActiveOfferForTenant(client.id);
  if (activeOffer?.items?.length) {
    return buildOfferPricingSummary(activeOffer.items, activeOffer.currency);
  }

  const purchases = await listPurchasesForTenant(client.id);
  const completed = purchases.find(
    (purchase) =>
      purchase.status === "active" ||
      purchase.status === "paid" ||
      purchase.purchased_at,
  ) as Purchase | undefined;

  const fromSnapshot = summaryFromSnapshot(
    completed?.purchase_snapshot as PurchaseSnapshot | null,
    client.currency,
  );
  if (fromSnapshot) return fromSnapshot;

  if (client.monthly_price_cents > 0) {
    return {
      planName: client.plan_name || "Your plan",
      currency: client.currency,
      baseMonthlyAmountCents: client.monthly_price_cents,
      recurringAddOnAmountCents: 0,
      recurringDiscountAmountCents: 0,
      discountedMonthlyAmountCents: client.monthly_price_cents,
      standardMonthlyAmountAfterDiscountCents: client.monthly_price_cents,
      discountDurationMonths: null,
      discountIsPermanent: false,
      oneTimeAmountCents: 0,
      dueAtCheckoutCents: client.monthly_price_cents,
    };
  }

  return null;
}
