import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitsForTests } from "@/lib/rate-limit";
import { checkForgotPasswordRateLimit } from "@/lib/auth/forgot-password-rate-limit";

describe("checkForgotPasswordRateLimit", () => {
  beforeEach(() => {
    resetRateLimitsForTests();
  });

  it("allows requests under both limits", () => {
    for (let i = 0; i < 3; i += 1) {
      expect(checkForgotPasswordRateLimit("10.0.0.1", "user@example.com")).toEqual({
        ok: true,
      });
    }
  });

  it("blocks when the email limit is reached", () => {
    const ip = "10.0.0.1";
    const email = "limited@example.com";

    expect(checkForgotPasswordRateLimit(ip, email).ok).toBe(true);
    expect(checkForgotPasswordRateLimit(ip, email).ok).toBe(true);
    expect(checkForgotPasswordRateLimit(ip, email).ok).toBe(true);
    expect(checkForgotPasswordRateLimit(ip, email).ok).toBe(false);
  });

  it("blocks when the IP limit is reached", () => {
    const ip = "10.0.0.2";

    for (let i = 0; i < 5; i += 1) {
      expect(
        checkForgotPasswordRateLimit(ip, `user-${i}@example.com`).ok,
      ).toBe(true);
    }

    expect(
      checkForgotPasswordRateLimit(ip, "another@example.com").ok,
    ).toBe(false);
  });

  it("applies email limits across different IPs", () => {
    const email = "shared@example.com";

    expect(checkForgotPasswordRateLimit("10.0.0.3", email).ok).toBe(true);
    expect(checkForgotPasswordRateLimit("10.0.0.4", email).ok).toBe(true);
    expect(checkForgotPasswordRateLimit("10.0.0.5", email).ok).toBe(true);
    expect(checkForgotPasswordRateLimit("10.0.0.6", email).ok).toBe(false);
  });

  it("allows different emails until the IP limit is reached", () => {
    const ip = "10.0.0.7";

    expect(checkForgotPasswordRateLimit(ip, "a@example.com").ok).toBe(true);
    expect(checkForgotPasswordRateLimit(ip, "b@example.com").ok).toBe(true);
    expect(checkForgotPasswordRateLimit(ip, "c@example.com").ok).toBe(true);
    expect(checkForgotPasswordRateLimit(ip, "d@example.com").ok).toBe(true);
    expect(checkForgotPasswordRateLimit(ip, "e@example.com").ok).toBe(true);
    expect(checkForgotPasswordRateLimit(ip, "f@example.com").ok).toBe(false);
  });

  it("normalizes email casing before applying the email limit", () => {
    expect(checkForgotPasswordRateLimit("10.0.0.8", "User@Example.com").ok).toBe(
      true,
    );
    expect(checkForgotPasswordRateLimit("10.0.0.8", "user@example.com").ok).toBe(
      true,
    );
    expect(
      checkForgotPasswordRateLimit("10.0.0.8", "USER@EXAMPLE.COM").ok,
    ).toBe(true);
    expect(
      checkForgotPasswordRateLimit("10.0.0.8", "user@example.com").ok,
    ).toBe(false);
  });
});
