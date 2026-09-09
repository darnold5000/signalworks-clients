import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { OfferCheckoutButton } from "@/components/offer-checkout-button";
import { PageHeader, Panel } from "@/components/ui";
import { getCurrentProfile } from "@/lib/auth";
import { getPrimaryClient } from "@/lib/data";
import {
  continueMixedCheckoutFromReturnedSession,
  requestFromHeaders,
} from "@/lib/offers/continue-mixed-checkout";
import { getStripe } from "@/lib/stripe";

const continueSearchSchema = z.object({
  session_id: z.string().trim().min(1).max(256).optional(),
});

export default async function ContinueMixedCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const parsed = continueSearchSchema.safeParse(await searchParams);
  const sessionId = parsed.success ? parsed.data.session_id : undefined;
  const profile = await getCurrentProfile();
  const client = await getPrimaryClient();
  const stripe = getStripe();
  let monthlyComplete = false;
  let nextPath: string | null = null;

  if (client && profile && stripe && sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const result = await continueMixedCheckoutFromReturnedSession({
        session,
        tenantId: client.id,
        purchaserUserId: profile.id,
        purchaserEmail: profile.email,
        request: requestFromHeaders(await headers()),
        existingCustomerId:
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id,
      });
      if (result.status === "redirect") {
        nextPath = result.url;
      } else if (result.status === "complete") {
        nextPath = `/billing/success?session_id=${encodeURIComponent(result.sessionId)}`;
      } else {
        monthlyComplete = result.status === "needs_manual_continue";
      }
    } catch {
      monthlyComplete = false;
    }
  }

  if (nextPath) {
    redirect(nextPath);
  }

  return (
    <>
      <PageHeader
        title={monthlyComplete ? "Monthly billing is set up" : "Confirming monthly billing"}
        description={
          monthlyComplete
            ? "One final step remains to activate annual billing."
            : "Stripe has not confirmed the first checkout step yet."
        }
      />
      <Panel>
        {monthlyComplete ? (
          <>
            <p className="text-sm text-muted">
              Your monthly subscription is active and will not be created again.
              Continue to Stripe to confirm the annual services in this agreement.
            </p>
            <div className="mt-6">
              <OfferCheckoutButton label="Continue to annual billing" />
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">
              Payment confirmation can take a moment. You can safely return to
              Billing and resume once Stripe confirms this step.
            </p>
            <Link
              href="/billing"
              className="mt-6 inline-flex rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
            >
              Return to Billing
            </Link>
          </>
        )}
      </Panel>
    </>
  );
}
