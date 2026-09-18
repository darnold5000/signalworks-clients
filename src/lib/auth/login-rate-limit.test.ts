import { beforeEach, describe, expect, it } from "vitest";
import { resetRateLimitsForTests } from "@/lib/rate-limit";
import { checkLoginRateLimit } from "@/lib/auth/login-rate-limit";

describe("checkLoginRateLimit", () => {
  beforeEach(() => {
    resetRateLimitsForTests();
  });

  it("allows requests under both limits", () => {
    for (let i = 0; i < 10; i += 1) {
      expect(checkLoginRateLimit("10.0.0.1", "user@example.com").ok).toBe(true);
    }
    expect(checkLoginRateLimit("10.0.0.1", "user@example.com").ok).toBe(false);
  });

  it("blocks when the IP limit is reached across emails", () => {
    const ip = "10.0.0.2";
    for (let i = 0; i < 20; i += 1) {
      expect(checkLoginRateLimit(ip, `user-${i}@example.com`).ok).toBe(true);
    }
    expect(checkLoginRateLimit(ip, "another@example.com").ok).toBe(false);
  });
});
