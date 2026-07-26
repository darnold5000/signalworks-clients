import Link from "next/link";
import { Panel } from "@/components/ui";
import { siteConfig } from "@/lib/site";
import { formatDate } from "@/lib/utils";

export function BillingServiceRestartPanel({
  supportEmail,
  periodEnd,
  cancelingAtPeriodEnd,
}: {
  supportEmail: string;
  periodEnd: string | null;
  cancelingAtPeriodEnd?: boolean;
}) {
  return (
    <Panel
      title={
        cancelingAtPeriodEnd
          ? "Subscription ending"
          : "Restart or change your plan"
      }
      className="mb-6 border-border"
    >
      <p className="text-sm text-muted">
        {cancelingAtPeriodEnd && periodEnd ? (
          <>
            Your subscription is scheduled to end on{" "}
            <strong>{formatDate(periodEnd)}</strong>. Self-serve checkout is not
            available for plan changes after cancellation.
          </>
        ) : (
          <>
            Your previous subscription is no longer active. To restart service or
            start a new agreement, contact Signal Works — we will not reopen
            self-serve checkout on an expired subscription automatically.
          </>
        )}
      </p>
      <p className="mt-4 text-sm">
        Email{" "}
        <a
          href={`mailto:${supportEmail}`}
          className="font-medium underline underline-offset-2"
        >
          {supportEmail}
        </a>{" "}
        or visit{" "}
        <Link href="/support" className="font-medium underline underline-offset-2">
          Support
        </Link>
        .
      </p>
      {canManageBillingHint(cancelingAtPeriodEnd) ? (
        <p className="mt-3 text-xs text-muted">
          You can still use Manage billing in Stripe for invoices and payment
          history through {siteConfig.name}.
        </p>
      ) : null}
    </Panel>
  );
}

function canManageBillingHint(cancelingAtPeriodEnd?: boolean): boolean {
  return Boolean(cancelingAtPeriodEnd);
}
