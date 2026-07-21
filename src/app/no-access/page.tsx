import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { siteConfig } from "@/lib/site";

export default async function NoAccessPage() {
  const profile = await requireUser();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <h1 className="text-lg font-medium text-foreground">No portal access</h1>
        <p className="mt-3 text-sm text-muted">
          Signed in as {profile.email}, but this account is not linked to a
          client tenant yet. If you are Signal Works staff, ask for a{" "}
          <code className="text-xs">platform_admin</code> membership on the
          internal <code className="text-xs">signalworks</code> tenant.
        </p>
        <p className="mt-4 text-sm text-muted">
          Need help?{" "}
          <a
            href={`mailto:${siteConfig.supportEmail}`}
            className="text-foreground underline"
          >
            {siteConfig.supportEmail}
          </a>
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-foreground underline"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
