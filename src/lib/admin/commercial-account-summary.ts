import type { ClientOffer, ClientOfferItem } from "@/lib/database/phase1-types";
import type { StripeBillingSnapshot } from "@/lib/admin/stripe-billing-snapshot";
import { calculateRecurringFinancials, type PurchaseFinancialRecord } from "@/lib/admin/recurring-financials";
import { recurringCadence } from "@/lib/offers/billing-cadence";
import { isEntitlementOfferItem } from "@/lib/offers/offer-item-metadata";

export type CommercialState =
  | "not_established"
  | "agreement_accepted"
  | "billing_setup_pending"
  | "active"
  | "inactive";

export type WebsiteManagementStatus =
  | "Pending Setup"
  | "Proposal Draft"
  | "Proposal Sent"
  | "Billing Setup Pending"
  | "Active"
  | "Inactive";

export type CommercialAccountSummary = {
  commercialState: CommercialState;
  websiteManagementStatus: WebsiteManagementStatus;
  planName: string | null;
  baseRecurringCents: number | null;
  currentRecurringCents: number | null;
  marginCents: number | null;
  source: "stripe" | "purchase" | "accepted_agreement" | "none";
};

export type CommercialOffer = Pick<
  ClientOffer,
  "id" | "title" | "status" | "billing_method" | "accepted_at" | "acceptance_snapshot" | "created_at"
> & { items: ClientOfferItem[] };

export type CommercialSubscription = {
  subscription_status: string;
  stripe_subscription_id: string | null;
};

export type CommercialPurchase = Omit<PurchaseFinancialRecord, "purchase_snapshot"> & {
  id?: string;
  purchase_snapshot: {
    offer?: { billing_method?: string | null; title?: string | null };
    items?: ClientOfferItem[];
  } | null;
};

function normalizeToMonthly(cents: number, item: ClientOfferItem): number {
  const cadence = recurringCadence(item);
  const months = cadence.interval === "year" ? cadence.intervalCount * 12 : cadence.intervalCount;
  return Math.round(cents / months);
}

function contractualBaseRecurring(items: ClientOfferItem[]): number | null {
  const recurring = items.filter(
    (item) =>
      item.is_selected &&
      item.billing_type === "recurring" &&
      item.item_type !== "discount" &&
      item.item_type !== "credit" &&
      !isEntitlementOfferItem(item),
  );
  if (recurring.length === 0) return null;
  return recurring.reduce(
    (sum, item) => sum + normalizeToMonthly(item.unit_amount_cents * item.quantity, item),
    0,
  );
}

function planNameFromItems(items: ClientOfferItem[], fallback?: string | null): string | null {
  return (
    items.find((item) => item.is_selected && item.item_type === "base_plan")?.name ??
    fallback?.trim() ??
    null
  );
}

function snapshotParts(snapshot: unknown): { items: ClientOfferItem[]; title: string | null } {
  if (!snapshot || typeof snapshot !== "object") return { items: [], title: null };
  const value = snapshot as { items?: unknown; offer?: { title?: unknown } };
  return {
    items: Array.isArray(value.items) ? (value.items as ClientOfferItem[]) : [],
    title: typeof value.offer?.title === "string" ? value.offer.title : null,
  };
}

function acceptedOfferParts(offer: CommercialOffer) {
  const immutable = snapshotParts(offer.acceptance_snapshot);
  return {
    items: immutable.items.length > 0 ? immutable.items : offer.items,
    title: immutable.title ?? offer.title,
  };
}

function latestOffer(offers: CommercialOffer[]) {
  return [...offers].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

function proposalStatus(offers: CommercialOffer[]): WebsiteManagementStatus {
  const offer = latestOffer(offers);
  if (!offer) return "Pending Setup";
  if (offer.status === "draft") return "Proposal Draft";
  if (offer.status === "published" || offer.status === "viewed") return "Proposal Sent";
  if (offer.status === "accepted" || offer.status === "checkout_started") return "Billing Setup Pending";
  if (offer.status === "purchased") return "Active";
  return "Inactive";
}

export function resolveCommercialAccountSummary(args: {
  tenantStatus: string;
  offers: CommercialOffer[];
  purchases: CommercialPurchase[];
  subscriptions: CommercialSubscription[];
  stripeSnapshot: StripeBillingSnapshot | null;
  recurringCostsCents: number | null;
}): CommercialAccountSummary {
  const activeSubscription = args.subscriptions.some(
    (subscription) =>
      Boolean(subscription.stripe_subscription_id) &&
      ["active", "trialing", "past_due"].includes(subscription.subscription_status),
  );
  const activePurchases = args.purchases.filter(
    (purchase) => purchase.status === "active" || purchase.status === "paid",
  );
  const latestPurchase = [...activePurchases].sort((a, b) =>
    String(b.purchased_at ?? "").localeCompare(String(a.purchased_at ?? "")),
  )[0];

  if (activeSubscription && args.stripeSnapshot) {
    const purchaseSnapshot = snapshotParts(latestPurchase?.purchase_snapshot);
    const accepted = latestOffer(
      args.offers.filter((offer) => ["accepted", "checkout_started", "purchased"].includes(offer.status)),
    );
    const acceptedParts = accepted ? acceptedOfferParts(accepted) : { items: [], title: null };
    const planItems = purchaseSnapshot.items.length ? purchaseSnapshot.items : acceptedParts.items;
    const current = args.stripeSnapshot.current.effectiveMrrCents;
    return {
      commercialState: "active",
      websiteManagementStatus: "Active",
      planName: planNameFromItems(planItems, purchaseSnapshot.title ?? acceptedParts.title),
      baseRecurringCents: args.stripeSnapshot.current.baseMrrCents,
      currentRecurringCents: current,
      marginCents: args.recurringCostsCents == null ? null : current - args.recurringCostsCents,
      source: "stripe",
    };
  }

  if (latestPurchase) {
    const parts = snapshotParts(latestPurchase.purchase_snapshot);
    const financials = calculateRecurringFinancials([{ items: parts.items }], args.recurringCostsCents ?? 0);
    const baseRecurringCents = contractualBaseRecurring(parts.items);
    const currentRecurringCents =
      baseRecurringCents == null ? null : financials.effectiveMrrCents;
    return {
      commercialState: "active",
      websiteManagementStatus: "Active",
      planName: planNameFromItems(parts.items, parts.title),
      baseRecurringCents,
      currentRecurringCents,
      marginCents:
        currentRecurringCents == null || args.recurringCostsCents == null
          ? null
          : currentRecurringCents - args.recurringCostsCents,
      source: "purchase",
    };
  }

  const accepted = latestOffer(
    args.offers.filter(
      (offer) =>
        ["accepted", "checkout_started"].includes(offer.status) &&
        Boolean(offer.accepted_at || offer.acceptance_snapshot),
    ),
  );
  if (accepted) {
    const parts = acceptedOfferParts(accepted);
    return {
      commercialState: accepted.status === "checkout_started" ? "billing_setup_pending" : "agreement_accepted",
      websiteManagementStatus: "Billing Setup Pending",
      planName: planNameFromItems(parts.items, parts.title),
      baseRecurringCents: contractualBaseRecurring(parts.items),
      currentRecurringCents: null,
      marginCents: null,
      source: "accepted_agreement",
    };
  }

  const websiteManagementStatus = proposalStatus(args.offers);
  const inactive = ["paused", "canceled", "archived"].includes(args.tenantStatus);
  return {
    commercialState: inactive ? "inactive" : "not_established",
    websiteManagementStatus: inactive ? "Inactive" : websiteManagementStatus,
    planName: null,
    baseRecurringCents: null,
    currentRecurringCents: null,
    marginCents: null,
    source: "none",
  };
}
