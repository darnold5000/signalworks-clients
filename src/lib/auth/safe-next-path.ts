/** Same-origin relative paths the portal may honor after login or auth callbacks. */

export function isSafeAppRelativePath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) {
    return false;
  }
  if (path.includes("://") || path.includes("\\")) return false;
  if (path.startsWith("/admin") || path.startsWith("/api")) return false;
  return true;
}

export const ALLOWED_AUTH_CALLBACK_NEXT_PATHS = new Set([
  "/auth/set-password",
  "/auth/accept-invite",
  "/auth/reset-password",
  "/offer",
  "/overview",
  "/login",
]);

export function resolveAuthCallbackNextPath(
  nextRaw: string | null,
  type: string | null,
): { path: string; isRecovery: boolean } {
  if (nextRaw && ALLOWED_AUTH_CALLBACK_NEXT_PATHS.has(nextRaw)) {
    return {
      path: nextRaw,
      isRecovery: nextRaw === "/auth/reset-password" || type === "recovery",
    };
  }
  if (type === "recovery") {
    return { path: "/auth/reset-password", isRecovery: true };
  }
  if (type === "magiclink" || type === "email") {
    return { path: "/offer", isRecovery: false };
  }
  return { path: "/auth/set-password", isRecovery: false };
}

export function resolvePostLoginRedirect(
  redirectTo: string,
  next: string | null,
): string {
  if (redirectTo !== "/overview") return redirectTo;
  if (!next || !isSafeAppRelativePath(next)) return redirectTo;
  return next;
}
