import type { SupabaseClient } from "@supabase/supabase-js";

export function readHashSession():
  | { access_token: string; refresh_token: string }
  | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

export function readHashAuthType(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;
  return new URLSearchParams(hash).get("type");
}

/**
 * When Supabase emails land on /login (or Site URL) with tokens in the hash or
 * query string, send the user to the page that can consume them.
 */
export function getAuthTokensRedirectUrl(): string | null {
  if (typeof window === "undefined") return null;

  const { search, hash } = window.location;
  if (search.includes("code=") || search.includes("token_hash=")) {
    return `/auth/callback${search}${hash}`;
  }

  if (!hash.includes("access_token")) return null;

  const type = readHashAuthType();
  const path =
    type === "recovery" ? "/auth/reset-password" : "/auth/accept-invite";
  return `${path}${hash}`;
}

export async function establishSessionFromAuthLink(
  supabase: SupabaseClient,
  cleanPath: string,
): Promise<
  | { ok: true; email: string | null; fullName: string | null }
  | { ok: false }
> {
  const params = new URLSearchParams(window.location.search);
  const hashSession = readHashSession();
  const code = params.get("code");

  if (hashSession) {
    await supabase.auth.signOut({ scope: "local" });
    const { error: hashError } = await supabase.auth.setSession(hashSession);
    window.history.replaceState({}, "", cleanPath);
    if (hashError) return { ok: false };
  } else if (code) {
    await supabase.auth.signOut({ scope: "local" });
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);
    window.history.replaceState({}, "", cleanPath);
    if (exchangeError) return { ok: false };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) return { ok: false };

  const metaName = session.user.user_metadata?.full_name;
  return {
    ok: true,
    email: session.user.email ?? null,
    fullName:
      typeof metaName === "string" && metaName.trim() ? metaName.trim() : null,
  };
}
