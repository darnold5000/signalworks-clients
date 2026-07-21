import { AuthTokenHandler } from "@/components/auth-token-handler";

/** Optional Supabase Site URL target — forwards tokens to the right auth page. */
export default function AuthConfirmPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_#ffffff_0%,_#f7f6f3_55%,_#efece6_100%)] px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-sm">
        <p className="text-sm text-muted">Continuing from your email link…</p>
      </div>
      <AuthTokenHandler />
    </div>
  );
}
