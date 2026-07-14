import type Stripe from "stripe";
import {
  getPlan,
  getPlanKeyFromPriceId,
  getPriceIdForPlan,
  type PlanKey,
} from "@/lib/plans";
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { SW_TABLES } from "@/lib/supabase/tables";
import type { SubscriptionStatus } from "@/lib/types";

function mapSubStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "incomplete":
    case "unpaid":
      return status;
    default:
      return "none";
  }
}

function customerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer,
) {
  return typeof customer === "string" ? customer : customer.id;
}

export async function syncClientFromCheckoutSession(
  session: Stripe.Checkout.Session,
) {
  if (!isSupabaseConfigured()) return;
  if (session.mode !== "subscription") return;

  const supabase = createServiceClient();
  const clientId =
    session.client_reference_id || session.metadata?.client_id || null;
  const customer =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  const subscription =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
  const planKey = session.metadata?.plan_key;
  const plan = planKey ? getPlan(planKey) : undefined;

  const payload: Record<string, unknown> = {
    stripe_customer_id: customer ?? null,
    stripe_subscription_id: subscription ?? null,
    subscription_status: "active",
    status: "active",
  };

  if (plan && planKey) {
    payload.plan_name = plan.name;
    payload.monthly_price_cents = plan.monthlyPriceCents;
    const priceId = getPriceIdForPlan(planKey as PlanKey);
    if (priceId) payload.stripe_price_id = priceId;
  }

  if (clientId) {
    await supabase.from(SW_TABLES.clients).update(payload).eq("id", clientId);
  } else if (customer) {
    await supabase
      .from(SW_TABLES.clients)
      .update(payload)
      .eq("stripe_customer_id", customer);
  }
}

export async function syncClientFromSubscription(sub: Stripe.Subscription) {
  if (!isSupabaseConfigured()) return;
  const supabase = createServiceClient();
  const item = sub.items.data[0];
  const price = item?.price;
  const periodEnd = item?.current_period_end;
  const priceId = typeof price === "string" ? price : price?.id;
  const planKey =
    (sub.metadata?.plan_key as string | undefined) ||
    (priceId ? getPlanKeyFromPriceId(priceId) : null);
  const plan = planKey ? getPlan(planKey) : undefined;

  const payload: Record<string, unknown> = {
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerId(sub.customer),
    stripe_price_id: priceId ?? null,
    subscription_status: mapSubStatus(sub.status),
    current_period_end: periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : null,
  };

  if (plan) {
    payload.plan_name = plan.name;
    payload.monthly_price_cents = plan.monthlyPriceCents;
  } else if (price && typeof price !== "string" && price.unit_amount != null) {
    payload.monthly_price_cents = price.unit_amount;
    if (price.currency) payload.currency = price.currency;
  }

  const clientId = sub.metadata?.client_id;
  if (clientId) {
    await supabase.from(SW_TABLES.clients).update(payload).eq("id", clientId);
    return;
  }

  await supabase
    .from(SW_TABLES.clients)
    .update(payload)
    .eq("stripe_customer_id", customerId(sub.customer));
}
