import type {
  ClientOffer,
  ClientOfferItem,
  Purchase,
  PurchaseItem,
} from "@/lib/database/phase1-types";
import { calculateOfferTotals } from "@/lib/offers/calculate-totals";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

export async function listPurchasesForTenant(
  tenantId: string,
): Promise<Purchase[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from(TABLES.purchases)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  return (data as Purchase[]) ?? [];
}

export async function getPurchaseWithItems(
  purchaseId: string,
): Promise<{ purchase: Purchase; items: PurchaseItem[] } | null> {
  const supabase = createServiceClient();
  const { data: purchase } = await supabase
    .from(TABLES.purchases)
    .select("*")
    .eq("id", purchaseId)
    .maybeSingle();

  if (!purchase) return null;

  const { data: items } = await supabase
    .from(TABLES.purchaseItems)
    .select("*")
    .eq("purchase_id", purchaseId)
    .order("created_at", { ascending: true });

  return {
    purchase: purchase as Purchase,
    items: (items as PurchaseItem[]) ?? [],
  };
}

function discountSummary(item: ClientOfferItem): string | null {
  if (!item.discount_type) return null;
  if (item.discount_type === "amount" && item.discount_amount_cents) {
    return `$${(item.discount_amount_cents / 100).toFixed(2)} off`;
  }
  if (item.discount_type === "percent" && item.discount_percent) {
    const months =
      item.discount_duration_type === "repeating"
        ? ` for ${item.discount_duration_months ?? 6} months`
        : item.discount_duration_type === "once"
          ? " (first invoice)"
          : "";
    return `${item.discount_percent}% off${months}`;
  }
  return null;
}

export async function createPurchaseFromOffer(args: {
  offer: ClientOffer;
  items: ClientOfferItem[];
  purchasedBy: string;
}): Promise<{ purchase: Purchase; items: PurchaseItem[] }> {
  const totals = calculateOfferTotals(args.items);
  const snapshot = {
    offer: args.offer,
    items: args.items,
    totals,
    captured_at: new Date().toISOString(),
  };

  const supabase = createServiceClient();
  const { data: purchase, error } = await supabase
    .from(TABLES.purchases)
    .insert({
      tenant_id: args.offer.tenant_id,
      offer_id: args.offer.id,
      status: "pending",
      currency: args.offer.currency,
      subtotal_cents: totals.subtotal_cents,
      discount_total_cents: totals.discount_total_cents,
      amount_due_today_cents: totals.initial_total_cents,
      recurring_total_cents: totals.recurring_total_cents,
      purchased_by: args.purchasedBy,
      purchase_snapshot: snapshot,
    })
    .select("*")
    .single();

  if (error || !purchase) {
    throw new Error(error?.message ?? "Could not create purchase");
  }

  const selected = args.items.filter((item) => item.is_selected);
  const purchaseItemsPayload = selected
    .filter(
      (item) =>
        item.item_type !== "discount" && item.item_type !== "credit",
    )
    .map((item) => ({
      purchase_id: purchase.id,
      tenant_id: args.offer.tenant_id,
      source_offer_item_id: item.id,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unit_amount_cents: item.unit_amount_cents,
      billing_type: item.billing_type,
      billing_interval: item.billing_interval,
      discount_summary: discountSummary(item),
      stripe_product_id: item.stripe_product_id,
      stripe_price_id: item.stripe_price_id,
      service_status:
        item.billing_type === "one_time" ? "completed" : "pending",
    }));

  const { data: purchaseItems, error: itemsError } = await supabase
    .from(TABLES.purchaseItems)
    .insert(purchaseItemsPayload)
    .select("*");

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  return {
    purchase: purchase as Purchase,
    items: (purchaseItems as PurchaseItem[]) ?? [],
  };
}
