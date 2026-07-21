import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { getCurrentProfile, isPlatformAdmin } from "@/lib/auth";
import { getClientById } from "@/lib/data";
import { getPriceIdForPlan, PLAN_KEYS, resolvePlanForClient } from "@/lib/plans";
import { siteConfig } from "@/lib/site";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

const bodySchema = z.object({
  clientId: z.string().uuid(),
  planKey: z.enum(PLAN_KEYS),
});

function isRealStripeId(id: string | null | undefined): id is string {
  return Boolean(id && !id.includes("_demo_"));
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 },
    );
  }

  const json = await request.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const client = await getClientById(parsed.data.clientId);
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Clients may only check out for their assigned plan. Admins can start any plan.
  const isAdmin = await isPlatformAdmin();
  if (!isAdmin) {
    const assigned = resolvePlanForClient({
      plan_name: client.plan_name,
      stripe_price_id: client.stripe_price_id,
    });
    if (!assigned || assigned.key !== parsed.data.planKey) {
      return NextResponse.json(
        { error: "That plan is not assigned to this account." },
        { status: 403 },
      );
    }
  }

  const priceId = getPriceIdForPlan(parsed.data.planKey);
  if (!priceId) {
    return NextResponse.json(
      {
        error: `Price ID not configured for plan "${parsed.data.planKey}". Add it to .env.local.`,
      },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe unavailable" }, { status: 503 });
  }

  const existingCustomer = isRealStripeId(client.stripe_customer_id)
    ? client.stripe_customer_id
    : undefined;

  const successUrl = isAdmin
    ? `${siteConfig.url}/admin/clients/${client.id}?checkout=success&session_id={CHECKOUT_SESSION_ID}`
    : `${siteConfig.url}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = isAdmin
    ? `${siteConfig.url}/admin/clients/${client.id}`
    : `${siteConfig.url}/billing`;

  // Tax requires a head office address in Stripe Tax settings.
  // Enable with STRIPE_AUTOMATIC_TAX=true after configuring:
  // https://dashboard.stripe.com/test/settings/tax
  const taxEnabled = process.env.STRIPE_AUTOMATIC_TAX === "true";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      ...(taxEnabled ? { automatic_tax: { enabled: true } } : {}),
      customer: existingCustomer,
      customer_email: existingCustomer ? undefined : profile.email || undefined,
      client_reference_id: client.id,
      metadata: {
        tenant_id: client.id,
        plan_key: parsed.data.planKey,
      },
      subscription_data: {
        metadata: {
          tenant_id: client.id,
          plan_key: parsed.data.planKey,
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message =
      err instanceof Stripe.errors.StripeError
        ? err.message
        : "Could not create Checkout session";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
