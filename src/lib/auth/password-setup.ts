import type { User } from "@supabase/supabase-js";

/** Invited users must set a password before using email/password sign-in. */
export function userNeedsPasswordSetup(user: User): boolean {
  if (user.user_metadata?.password_set === true) return false;
  const invitedAt = (user as User & { invited_at?: string | null }).invited_at;
  return Boolean(invitedAt);
}

export const AUTH_SETUP_PATH_PREFIXES = [
  "/auth/set-password",
  "/auth/accept-invite",
  "/auth/reset-password",
  "/auth/callback",
  "/auth/confirm",
  "/api/auth/",
] as const;

export function isAuthSetupPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  return AUTH_SETUP_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );
}
