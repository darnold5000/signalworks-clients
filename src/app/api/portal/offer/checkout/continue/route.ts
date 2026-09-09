import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { getPrimaryClient } from "@/lib/data";
import { continueMixedCheckoutFromReturnedSession } from "@/lib/offers/continue-mixed-checkout";
import { getStripe } from "@/lib/stripe";

const sessionIdSchema = z.string().trim().min(1).max(256);

/** Continue a mixed monthly/annual purchase into its next hosted Checkout stage. */
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  const client = await getPrimaryClient();
  const stripe = getStripe();
  const parsedSessionId = sessionIdSchema.safeParse(
    new URL(request.url).searchParams.get("session_id"),
  );
  if (!profile || !client || !stripe || !parsedSessionId.success) {
    return NextResponse.redirect(new URL("/offer", request.url));
  }

  try {
    const completed = await stripe.checkout.sessions.retrieve(
      parsedSessionId.data,
    );
    if (completed.metadata?.tenant_id !== client.id) {
      return NextResponse.redirect(new URL("/offer", request.url));
    }

    const result = await continueMixedCheckoutFromReturnedSession({
      session: completed,
      tenantId: client.id,
      purchaserUserId: profile.id,
      purchaserEmail: profile.email,
      request,
      existingCustomerId:
        typeof completed.customer === "string"
          ? completed.customer
          : completed.customer?.id,
    });
    if (result.status === "redirect") {
      return NextResponse.redirect(result.url);
    }
    if (result.status === "complete") {
      return NextResponse.redirect(
        new URL(
          `/billing/success?session_id=${encodeURIComponent(result.sessionId)}`,
          request.url,
        ),
      );
    }
    return NextResponse.redirect(
      new URL(
        `/billing/continue?session_id=${encodeURIComponent(parsedSessionId.data)}`,
        request.url,
      ),
    );
  } catch {
    return NextResponse.redirect(new URL("/offer", request.url));
  }
}
