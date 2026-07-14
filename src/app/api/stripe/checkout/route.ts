import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { getClientById } from "@/lib/data";
import { getPriceIdForPlan, PLAN_KEYS } from "@/lib/plans";
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

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    automatic_tax: { enabled: true },
    customer: existingCustomer,
    customer_email: existingCustomer ? undefined : profile.email || undefined,
    client_reference_id: client.id,
    metadata: {
      client_id: client.id,
      plan_key: parsed.data.planKey,
    },
    subscription_data: {
      metadata: {
        client_id: client.id,
        plan_key: parsed.data.planKey,
      },
    },
    success_url: `${siteConfig.url}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteConfig.url}/billing`,
  });

  return NextResponse.json({ url: session.url });
}
