import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import {
  syncClientFromCheckoutSession,
  syncClientFromSubscription,
  syncTenantBillingStatus,
} from "@/lib/stripe-sync";
import {
  claimStripeWebhookEvent,
  markStripeWebhookProcessed,
} from "@/lib/stripe/webhook-idempotency";
import { isSupabaseConfigured } from "@/lib/supabase/server";

function customerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer) {
  return typeof customer === "string" ? customer : customer.id;
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

  if (isSupabaseConfigured()) {
    try {
      const { duplicate } = await claimStripeWebhookEvent(event);
      if (duplicate) {
        return NextResponse.json({ received: true, duplicate: true });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Webhook idempotency failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await syncClientFromCheckoutSession(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncClientFromSubscription(
          event.data.object as Stripe.Subscription,
        );
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (isSupabaseConfigured() && invoice.customer) {
          await syncTenantBillingStatus(
            customerId(invoice.customer),
            "past_due",
            "past_due",
          );
        }
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        if (isSupabaseConfigured() && invoice.customer) {
          await syncTenantBillingStatus(
            customerId(invoice.customer),
            "active",
            "active",
          );
        }
        break;
      }
      default:
        break;
    }

    if (isSupabaseConfigured()) {
      await markStripeWebhookProcessed(event.id);
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Webhook processing failed";
    if (isSupabaseConfigured()) {
      await markStripeWebhookProcessed(event.id, message);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
