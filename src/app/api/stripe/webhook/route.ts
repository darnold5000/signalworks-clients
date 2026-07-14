import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  getPlan,
  getPlanKeyFromPriceId,
  getPriceIdForPlan,
  type PlanKey,
} from "@/lib/plans";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import {
  createServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
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

function customerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer) {
  return typeof customer === "string" ? customer : customer.id;
}

async function syncSubscription(sub: Stripe.Subscription) {
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
    await supabase.from("clients").update(payload).eq("id", clientId);
    return;
  }

  await supabase
    .from("clients")
    .update(payload)
    .eq("stripe_customer_id", customerId(sub.customer));
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
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
    await supabase.from("clients").update(payload).eq("id", clientId);
  } else if (customer) {
    await supabase
      .from("clients")
      .update(payload)
      .eq("stripe_customer_id", customer);
  }
}

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 503 },
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe unavailable" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing webhook signature configuration" },
      { status: 400 },
    );
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      await handleCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session,
      );
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      if (isSupabaseConfigured() && invoice.customer) {
        const supabase = createServiceClient();
        await supabase
          .from("clients")
          .update({ subscription_status: "past_due", status: "past_due" })
          .eq("stripe_customer_id", customerId(invoice.customer));
      }
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      if (isSupabaseConfigured() && invoice.customer) {
        const supabase = createServiceClient();
        await supabase
          .from("clients")
          .update({ subscription_status: "active", status: "active" })
          .eq("stripe_customer_id", customerId(invoice.customer));
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
