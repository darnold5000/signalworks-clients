import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { checkoutSessionCompleted } from "@/lib/offers/checkout-state";
import {
  getPublicProposalForCheckout,
  stripeSessionMatchesProposal,
} from "@/lib/proposals/public-checkout";
import { siteConfig } from "@/lib/site";
import { getStripe } from "@/lib/stripe";
import { syncClientFromCheckoutSession } from "@/lib/stripe-sync";

const successSearchSchema = z.object({
  session_id: z.string().trim().min(1).max(256).optional(),
});

export default async function PublicProposalCheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { token } = await params;
  const parsed = successSearchSchema.safeParse(await searchParams);
  const sessionId = parsed.success ? parsed.data.session_id : undefined;
  const proposal = await getPublicProposalForCheckout(token);
  if (!proposal) notFound();

  const stripe = getStripe();
  let synced = false;

  if (stripe && sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (
        !stripeSessionMatchesProposal({
          session,
          offerId: proposal.offer.id,
          tenantId: proposal.offer.tenant_id,
        })
      ) {
        notFound();
      }
      if (checkoutSessionCompleted(session)) {
        await syncClientFromCheckoutSession(session);
        synced = true;
      }
    } catch {
      synced = false;
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-foreground">
        Your services are set up
      </h1>
      <p className="mt-3 text-sm text-muted">
        {synced
          ? "Stripe confirmed payment for this proposal. Signal Works will continue onboarding from here."
          : "Payment confirmation can take a moment. If anything still looks incomplete, return to your proposal and resume checkout."}
      </p>
      <div className="mt-6 rounded-lg border border-border bg-surface p-4 text-sm text-muted">
        <p className="font-medium text-foreground">
          Manage your website and billing
        </p>
        <p className="mt-2">
          Your {siteConfig.productName} portal account is separate from this
          proposal payment. If you do not already have portal access, ask your
          Signal Works contact to send an invite to{" "}
          <span className="font-medium text-foreground">
            {proposal.recipient.email}
          </span>
          . After that, sign in or use Forgot Password to set up your password.
        </p>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/proposal/${token}`}
          className="inline-flex rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-background"
        >
          Return to proposal
        </Link>
        <Link
          href="/login"
          className="inline-flex rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Sign in to {siteConfig.productName}
        </Link>
      </div>
    </main>
  );
}
