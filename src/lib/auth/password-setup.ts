import type { User } from "@supabase/supabase-js";

function invitedAtMs(user: User): number | null {
  const invitedAt = (user as User & { invited_at?: string | null }).invited_at;
  if (!invitedAt) return null;
  const ms = new Date(invitedAt).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function lastSignInMs(user: User): number | null {
  if (!user.last_sign_in_at) return null;
  const ms = new Date(user.last_sign_in_at).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Invited users must set a portal password before email/password sign-in,
 * unless they already had an established sign-in on shared Supabase Auth
 * (e.g. MA5/DAWG) before this portal invite was issued.
 */
export function userNeedsPasswordSetup(user: User): boolean {
  if (user.user_metadata?.password_set === true) return false;

  const invited = invitedAtMs(user);
  if (!invited) return false;

  const lastSignIn = lastSignInMs(user);
  if (!lastSignIn) return true;

  // Signed in well before the invite was created — existing shared-auth user.
  if (lastSignIn < invited - 60_000) return false;

  // Signed in long after invite was issued — returning user (magic link / login).
  if (lastSignIn - invited > 5 * 60_000) return false;

  return true;
}

export const AUTH_SETUP_PATH_PREFIXES = [
  "/auth/set-password",
  "/auth/accept-invite",
  "/auth/reset-password",
  "/auth/callback",
  "/auth/confirm",
  "/auth/establish-session",
  "/api/auth/",
] as const;

export function isAuthSetupPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  return AUTH_SETUP_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );
}
