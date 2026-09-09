import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import {
  continueMixedCheckoutFromReturnedSession,
  isSafeCheckoutRedirectUrl,
  requestFromHeaders,
} from "@/lib/offers/continue-mixed-checkout";
import {
  resolvePublicCheckoutSessionId,
  stripeSessionMatchesProposal,
} from "@/lib/proposals/public-checkout";
import { getStripe } from "@/lib/stripe";

const continueSearchSchema = z.object({
  session_id: z.string().trim().min(1).max(256).optional(),
});

export default async function PublicProposalCheckoutContinuePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { token } = await params;
  const parsed = continueSearchSchema.safeParse(await searchParams);
  const sessionIdFromQuery = parsed.success ? parsed.data.session_id : undefined;
  const resolved = await resolvePublicCheckoutSessionId({
    token,
    sessionIdFromQuery,
  });
  if ("error" in resolved && resolved.error === "not_found") notFound();

  const stripe = getStripe();
  let nextPath: string | null = null;
  let awaitingConfirmation = "error" in resolved && resolved.error === "not_ready";
  let needsManualContinue = false;

  if (stripe && !("error" in resolved)) {
    const { proposal, sessionId } = resolved;
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

      if (
        session.status === "open" &&
        session.url &&
        isSafeCheckoutRedirectUrl(session.url)
      ) {
        nextPath = session.url;
      } else {
        const result = await continueMixedCheckoutFromReturnedSession({
          session,
          tenantId: proposal.offer.tenant_id,
          purchaserUserId: null,
          purchaserEmail: proposal.recipient.email,
          request: requestFromHeaders(
            await headers(),
            `/proposal/${token}/checkout/continue`,
          ),
          existingCustomerId:
            typeof session.customer === "string"
              ? session.customer
              : session.customer?.id,
          returnContext: { kind: "public_proposal", token },
        });

        if (result.status === "redirect") {
          nextPath = result.url;
        } else if (result.status === "complete") {
          nextPath = `/proposal/${token}/checkout/success?session_id=${encodeURIComponent(result.sessionId)}`;
        } else {
          awaitingConfirmation = result.status === "awaiting_confirmation";
          needsManualContinue = result.status === "needs_manual_continue";
        }
      }
    } catch {
      awaitingConfirmation = true;
    }
  }

  if (nextPath) {
    redirect(nextPath);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-foreground">
        {needsManualContinue
          ? "Monthly billing is set up"
          : "Confirming your payment"}
      </h1>
      <p className="mt-3 text-sm text-muted">
        {needsManualContinue
          ? "One final step remains to activate annual billing for this proposal."
          : awaitingConfirmation
            ? "Stripe has not confirmed the previous checkout step yet. You can safely return to your proposal and try again in a moment."
            : "We could not resume checkout from this link."}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        {needsManualContinue ? (
          <Link
            href={`/proposal/${token}/checkout/continue`}
            className="inline-flex rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Continue to annual billing
          </Link>
        ) : null}
        <Link
          href={`/proposal/${token}`}
          className="inline-flex rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-background"
        >
          Return to proposal
        </Link>
      </div>
    </main>
  );
}
