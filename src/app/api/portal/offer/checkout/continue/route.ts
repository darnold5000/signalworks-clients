import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { getPrimaryClient } from "@/lib/data";
import { getStripe } from "@/lib/stripe";
import { syncClientFromCheckoutSession } from "@/lib/stripe-sync";

/** Continue a mixed monthly/annual purchase into its next hosted Checkout stage. */
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  const client = await getPrimaryClient();
  const stripe = getStripe();
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!profile || !client || !stripe || !sessionId) {
    return NextResponse.redirect(new URL("/offer", request.url));
  }

  try {
    const completed = await stripe.checkout.sessions.retrieve(sessionId);
    if (
      completed.status !== "complete" ||
      completed.metadata?.tenant_id !== client.id
    ) {
      return NextResponse.redirect(new URL("/offer", request.url));
    }

    await syncClientFromCheckoutSession(completed);
    // Compatibility for Checkout Sessions created before the transition page
    // became the success URL.
    return NextResponse.redirect(
      new URL(
        `/billing/continue?session_id=${encodeURIComponent(sessionId)}`,
        request.url,
      ),
    );
  } catch {
    return NextResponse.redirect(new URL("/offer", request.url));
  }
}
