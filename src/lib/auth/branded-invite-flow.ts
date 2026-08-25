/** Branded Signal Works invite links (token_hash + confirm-invite route). */
export function isBrandedInviteFlowEnabled(): boolean {
  return process.env.SIGNALWORKS_BRANDED_INVITE_FLOW === "true";
}

export const ALLOWED_INVITE_NEXT_PATHS = new Set([
  "/auth/set-password",
  "/auth/accept-invite",
]);

export const ALLOWED_RECOVERY_NEXT_PATHS = new Set([
  "/auth/reset-password",
]);

export function resolveInviteNextPath(nextRaw: string | null): string {
  if (nextRaw && ALLOWED_INVITE_NEXT_PATHS.has(nextRaw)) {
    return nextRaw;
  }
  return "/auth/set-password";
}

export function resolveRecoveryNextPath(nextRaw: string | null): string {
  if (nextRaw && ALLOWED_RECOVERY_NEXT_PATHS.has(nextRaw)) {
    return nextRaw;
  }
  return "/auth/reset-password";
}

export function buildBrandedConfirmInviteUrl(
  portalUrl: string,
  hashedToken: string,
  nextPath = "/auth/set-password",
): string {
  const base = portalUrl.replace(/\/$/, "");
  const url = new URL("/auth/confirm-invite", base);
  url.searchParams.set("token_hash", hashedToken);
  url.searchParams.set("type", "invite");
  url.searchParams.set("next", resolveInviteNextPath(nextPath));
  return url.toString();
}

/** Recovery links use token_hash server verification — works across devices and in-app mail browsers. */
export function buildBrandedConfirmRecoveryUrl(
  portalUrl: string,
  hashedToken: string,
  nextPath = "/auth/reset-password",
): string {
  const base = portalUrl.replace(/\/$/, "");
  const url = new URL("/auth/confirm-recovery", base);
  url.searchParams.set("token_hash", hashedToken);
  url.searchParams.set("type", "recovery");
  url.searchParams.set("next", resolveRecoveryNextPath(nextPath));
  return url.toString();
}

export type InviteErrorReason =
  | "missing-token"
  | "invalid-link"
  | "expired"
  | "already-used"
  | "not-authorized";

export function mapVerifyOtpFailureToReason(message: string): InviteErrorReason {
  const lower = message.toLowerCase();
  if (lower.includes("expired")) return "expired";
  if (lower.includes("already") || lower.includes("used")) return "already-used";
  return "invalid-link";
}

export function inviteErrorPath(reason: InviteErrorReason): string {
  return `/auth/invite-error?reason=${encodeURIComponent(reason)}`;
}

export function recoveryLinkErrorPath(): string {
  return "/auth/reset-password?error=recovery_link";
}
