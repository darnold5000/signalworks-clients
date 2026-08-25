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
    const params = new URLSearchParams(search.replace(/^\?/, ""));
    const type = params.get("type");
    if (type === "recovery" || params.get("token_hash")) {
      const tokenHash = params.get("token_hash");
      if (tokenHash && type === "recovery") {
        return `/auth/confirm-recovery${search}${hash}`;
      }
    }
    return `/auth/callback${search}${hash}`;
  }

  if (!hash.includes("access_token")) return null;

  const type = readHashAuthType();
  if (type === "recovery") {
    return `/auth/reset-password${hash}`;
  }
  if (type === "magiclink" || type === "email") {
    const next =
      new URLSearchParams(window.location.search).get("next") ?? "/offer";
    return `/auth/establish-session?next=${encodeURIComponent(next)}${hash}`;
  }
  return `/auth/set-password${hash}`;
}

export async function establishSessionFromAuthLink(
  supabase: SupabaseClient,
  cleanPath: string,
): Promise<
  | { ok: true; email: string | null; fullName: string | null }
  | { ok: false; reason?: string }
> {
  const params = new URLSearchParams(window.location.search);
  const hashSession = readHashSession();
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const otpType = params.get("type");

  if (hashSession) {
    await supabase.auth.signOut({ scope: "local" });
    const { error: hashError } = await supabase.auth.setSession(hashSession);
    window.history.replaceState({}, "", cleanPath);
    if (hashError) {
      return { ok: false, reason: hashError.message };
    }
  } else if (code) {
    await supabase.auth.signOut({ scope: "local" });
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);
    window.history.replaceState({}, "", cleanPath);
    if (exchangeError) {
      return { ok: false, reason: exchangeError.message };
    }
  } else if (tokenHash && otpType) {
    await supabase.auth.signOut({ scope: "local" });
    const { error: otpError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType as
        | "invite"
        | "recovery"
        | "email"
        | "signup"
        | "magiclink",
    });
    window.history.replaceState({}, "", cleanPath);
    if (otpError) {
      return { ok: false, reason: otpError.message };
    }
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return { ok: false, reason: "no_session" };
  }

  const metaName = session.user.user_metadata?.full_name;
  return {
    ok: true,
    email: session.user.email ?? null,
    fullName:
      typeof metaName === "string" && metaName.trim() ? metaName.trim() : null,
  };
}
