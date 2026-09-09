import Link from "next/link";

export function PublicProposalCheckoutResume({
  token,
  needsAnnualSetup,
  needsCheckoutResume,
  purchaseComplete,
}: {
  token: string;
  needsAnnualSetup: boolean;
  needsCheckoutResume: boolean;
  purchaseComplete: boolean;
}) {
  if (purchaseComplete) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-success">
          Payment setup for this proposal is complete.
        </p>
        <Link
          href={`/proposal/${token}/checkout/success`}
          className="inline-flex rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-background"
        >
          View confirmation
        </Link>
      </div>
    );
  }

  if (!needsCheckoutResume) return null;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {needsAnnualSetup
          ? "Monthly billing is active for this proposal. Continue in Stripe to finish annual billing setup. No portal login is required."
          : "Payment setup for this proposal is still in progress. Continue in Stripe to finish checkout. No portal login is required."}
      </p>
      <Link
        href={`/proposal/${token}/checkout/continue`}
        className="inline-flex rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
      >
        {needsAnnualSetup ? "Continue to annual billing" : "Continue payment setup"}
      </Link>
    </div>
  );
}
