/** Temporary auth/session debugging. Set DEBUG_AUTH=true (server) and NEXT_PUBLIC_DEBUG_AUTH=true (browser). */

export function isAuthDebugEnabled(): boolean {
  return process.env.DEBUG_AUTH === "true";
}

export function isClientAuthDebugEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEBUG_AUTH === "true";
}

export function authDebug(scope: string, detail?: Record<string, unknown>) {
  if (!isAuthDebugEnabled()) return;
  console.info(`[auth:${scope}]`, detail ?? {});
}
