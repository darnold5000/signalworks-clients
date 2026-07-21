import { redirect } from "next/navigation";
import { PageHeader, Panel } from "@/components/ui";
import { getStripe } from "@/lib/stripe";
import { syncClientFromCheckoutSession } from "@/lib/stripe-sync";

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  const stripe = getStripe();

  let planLabel: string | null = null;
  let synced = false;

  if (stripe && sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      planLabel = session.metadata?.plan_key ?? null;
      if (session.payment_status === "paid" || session.status === "complete") {
        await syncClientFromCheckoutSession(session);
        synced = true;
      }
    } catch {
      // Session lookup is best-effort for the confirmation UI
    }
  }

  if (synced) {
    redirect("/billing?checkout=success");
  }

  return (
    <>
      <PageHeader
        title="Payment received"
        description="Stripe confirmed your payment."
      />
      <Panel>
        <p className="text-sm text-muted">
          {planLabel
            ? `Checkout completed for plan: ${planLabel}.`
            : "Checkout completed successfully."}
        </p>
        <p className="mt-4 text-sm text-muted">
          If Billing still looks empty, refresh once — sync can take a moment.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/billing"
            className="inline-flex rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Go to Billing
          </a>
          <a
            href="/purchases"
            className="inline-flex rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium hover:bg-background"
          >
            View purchases
          </a>
        </div>
      </Panel>
    </>
  );
}
