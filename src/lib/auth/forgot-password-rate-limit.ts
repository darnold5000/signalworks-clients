import { createHash } from "node:crypto";
import { checkRateLimit } from "@/lib/rate-limit";

const HOUR_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_IP_PER_HOUR = 5;
const MAX_REQUESTS_PER_EMAIL_PER_HOUR = 3;

function hashNormalizedEmail(normalizedEmail: string): string {
  return createHash("sha256").update(normalizedEmail).digest("hex");
}

export function checkForgotPasswordRateLimit(
  ip: string,
  email: string,
): { ok: boolean } {
  const normalizedEmail = email.trim().toLowerCase();

  const ipLimit = checkRateLimit(
    `forgot-password:ip:${ip}`,
    MAX_REQUESTS_PER_IP_PER_HOUR,
    HOUR_MS,
  );
  if (!ipLimit.ok) {
    return { ok: false };
  }

  const emailLimit = checkRateLimit(
    `forgot-password:email:${hashNormalizedEmail(normalizedEmail)}`,
    MAX_REQUESTS_PER_EMAIL_PER_HOUR,
    HOUR_MS,
  );
  if (!emailLimit.ok) {
    return { ok: false };
  }

  return { ok: true };
}
