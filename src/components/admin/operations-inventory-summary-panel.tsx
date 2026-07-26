import type { OperationsInventorySummary } from "@/lib/technical/operations-inventory";
import { Panel } from "@/components/ui";
import Link from "next/link";

export function OperationsInventorySummaryPanel({
  summary,
}: {
  summary: OperationsInventorySummary;
}) {
  const attention: string[] = [];
  if (summary.supabaseHobby > 0) {
    attention.push(
      `${summary.supabaseHobby} client${summary.supabaseHobby === 1 ? "" : "s"} on Supabase Hobby`,
    );
  }
  if (summary.missingMfaAccess.length > 0) {
    attention.push(
      `${summary.missingMfaAccess.length} client${summary.missingMfaAccess.length === 1 ? "" : "s"} missing MFA on Signal Works–accessible vendors`,
    );
  }

  return (
    <Panel title="Operations inventory">
      <p className="text-sm text-muted">
        Roll-up across clients with a technical profile. Use{" "}
        <Link href="/admin/clients" className="underline underline-offset-2">
          Infrastructure filters
        </Link>{" "}
        on the client list to drill in.
      </p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs text-muted uppercase">Clients</dt>
          <dd className="font-display text-2xl">{summary.clientCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted uppercase">Supabase Pro / Hobby</dt>
          <dd className="font-medium">
            {summary.supabasePro} / {summary.supabaseHobby}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted uppercase">Vercel / Cloud Run</dt>
          <dd className="font-medium">
            {summary.vercel} / {summary.cloudRun}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted uppercase">GoDaddy / CF DNS</dt>
          <dd className="font-medium">
            {summary.godaddy} / {summary.cloudflareDns}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted uppercase">Stripe connected</dt>
          <dd className="font-medium">{summary.stripeConnected}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted uppercase">Google Workspace</dt>
          <dd className="font-medium">{summary.googleWorkspace}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted uppercase">Resend Pro</dt>
          <dd className="font-medium">{summary.resendPro}</dd>
        </div>
      </dl>
      {attention.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="font-medium">Needs attention</p>
          <ul className="mt-1 list-inside list-disc">
            {attention.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}
