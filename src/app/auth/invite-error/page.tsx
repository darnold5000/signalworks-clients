import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Invitation unavailable",
  robots: { index: false, follow: false },
};

const REASON_COPY: Record<string, string> = {
  "missing-token":
    "This invitation link is incomplete. Request a new invitation and we'll send you a fresh link.",
  "invalid-link":
    "This invitation link is invalid or has expired. Request a new invitation and we'll send you a fresh link.",
  expired:
    "This invitation link has expired. Request a new invitation and we'll send you a fresh link.",
  "already-used":
    "This invitation link has already been used. If you need access, sign in or request a new invitation.",
  "not-authorized":
    "We could not verify your access for this invitation. Contact Signal Works if you believe this is a mistake.",
};

type PageProps = {
  searchParams: Promise<{ reason?: string }>;
};

export default async function InviteErrorPage({ searchParams }: PageProps) {
  const { reason } = await searchParams;
  const message =
    (reason && REASON_COPY[reason]) ?? REASON_COPY["invalid-link"];

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_#ffffff_0%,_#f7f6f3_55%,_#efece6_100%)] px-4">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-surface p-8 shadow-sm">
        <h1 className="font-display text-2xl">Invitation unavailable</h1>
        <p className="text-sm text-muted">{message}</p>
        <div className="flex flex-col gap-2 text-sm">
          <Link
            href="/login"
            className="font-medium underline underline-offset-2"
          >
            Back to sign in
          </Link>
          <a
            href="mailto:hello@hiresignalworks.com"
            className="font-medium underline underline-offset-2"
          >
            Contact hello@hiresignalworks.com
          </a>
        </div>
      </div>
    </div>
  );
}
