import { createHash } from "node:crypto";
import { checkRateLimit } from "@/lib/rate-limit";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_IP = 20;
const MAX_REQUESTS_PER_EMAIL = 10;

function hashNormalizedEmail(normalizedEmail: string): string {
  return createHash("sha256").update(normalizedEmail).digest("hex");
}

export function checkLoginRateLimit(ip: string, email: string): { ok: boolean } {
  const normalizedEmail = email.trim().toLowerCase();

  const ipLimit = checkRateLimit(`login:ip:${ip}`, MAX_REQUESTS_PER_IP, WINDOW_MS);
  if (!ipLimit.ok) return { ok: false };

  const emailLimit = checkRateLimit(
    `login:email:${hashNormalizedEmail(normalizedEmail)}`,
    MAX_REQUESTS_PER_EMAIL,
    WINDOW_MS,
  );
  if (!emailLimit.ok) return { ok: false };

  return { ok: true };
}
