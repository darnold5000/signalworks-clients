import type { Metadata } from "next";
import { Suspense } from "react";
import { EstablishSessionRedirect } from "@/components/auth/establish-session-redirect";

export const metadata: Metadata = {
  title: "Signing in",
  robots: { index: false, follow: false },
};

export default function EstablishSessionPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_#ffffff_0%,_#f7f6f3_55%,_#efece6_100%)] px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-sm">
        <Suspense fallback={<p className="text-sm text-muted">Signing you in…</p>}>
          <EstablishSessionRedirect />
        </Suspense>
      </div>
    </div>
  );
}
