import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { getClientById } from "@/lib/data";
import { siteConfig } from "@/lib/site";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

const bodySchema = z.object({
  clientId: z.string().uuid(),
});

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error:
          "Stripe is not configured. Add STRIPE_SECRET_KEY to .env.local.",
      },
      { status: 503 },
    );
  }

  if (!client.stripe_customer_id || client.stripe_customer_id.includes("_demo_")) {
    return NextResponse.json(
      {
        error:
          "No real Stripe customer linked yet. Complete Checkout first, then Manage Billing will work.",
      },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe unavailable" }, { status: 503 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: client.stripe_customer_id,
    return_url: `${siteConfig.url}/billing`,
  });

  return NextResponse.json({ url: session.url });
}
