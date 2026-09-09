import Link from "next/link";
import { OfferCheckoutButton } from "@/components/offer-checkout-button";
import { PageHeader, Panel } from "@/components/ui";
import { getPrimaryClient } from "@/lib/data";
import { checkoutSessionCompleted } from "@/lib/offers/checkout-state";
import { getStripe } from "@/lib/stripe";
import { syncClientFromCheckoutSession } from "@/lib/stripe-sync";

export default async function ContinueMixedCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  const client = await getPrimaryClient();
  const stripe = getStripe();
  let monthlyComplete = false;

  if (client && stripe && sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      monthlyComplete =
        session.metadata?.tenant_id === client.id &&
        session.metadata?.checkout_stage_cadence === "month" &&
        session.metadata?.checkout_stage_final === "false" &&
        checkoutSessionCompleted(session);
      if (monthlyComplete) {
        // This is an idempotent recovery path. Stripe webhooks remain the
        // authoritative normal path, but a delayed webhook never blocks resume.
        await syncClientFromCheckoutSession(session);
      }
    } catch {
      monthlyComplete = false;
    }
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
