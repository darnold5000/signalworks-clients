import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui";
import { getStripe } from "@/lib/stripe";

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  const stripe = getStripe();

  let planLabel: string | null = null;
  if (stripe && sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      planLabel = session.metadata?.plan_key ?? null;
    } catch {
      // Session lookup is best-effort for the confirmation UI
    }
  }

  return (
    <>
      <PageHeader
        title="You're subscribed"
        description="Stripe confirmed your payment. Your plan will sync to this portal shortly."
      />
      <Panel>
        <p className="text-sm text-muted">
          {planLabel
            ? `Checkout completed for plan: ${planLabel}.`
            : "Checkout completed successfully."}
        </p>
        <p className="mt-4 text-sm text-muted">
          You can manage your card and invoices anytime from Billing.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/billing"
            className="inline-flex rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Go to Billing
          </Link>
          <Link
            href="/overview"
            className="inline-flex rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium hover:bg-background"
          >
            Overview
          </Link>
        </div>
      </Panel>
    </>
  );
}
