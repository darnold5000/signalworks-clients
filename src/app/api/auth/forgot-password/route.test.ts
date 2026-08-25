import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitsForTests } from "@/lib/rate-limit";

const {
  generateLink,
  resetPasswordForEmail,
  sendPasswordResetEmail,
  isServiceRoleConfigured,
} = vi.hoisted(() => ({
  generateLink: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  isServiceRoleConfigured: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  isServiceRoleConfigured,
  createServiceClient: () => ({
    auth: {
      admin: {
        generateLink,
      },
    },
  }),
}));

vi.mock("@/lib/email/password-reset-email", () => ({
  sendPasswordResetEmail,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      resetPasswordForEmail,
    },
  }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
  }),
}));

import { POST } from "@/app/api/auth/forgot-password/route";

const SUPABASE_URL = "https://test-project.supabase.co";
const ANON_KEY = "test-anon-key";

function forgotPasswordRequest(
  email: string,
  ip = "203.0.113.10",
): Request {
  return new Request("http://localhost/api/auth/forgot-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify({ email }),
  });
}

async function postForgotPassword(email: string, ip?: string) {
  const response = await POST(forgotPasswordRequest(email, ip));
  const body = await response.json();
  return { response, body };
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    resetRateLimitsForTests();
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", ANON_KEY);
    isServiceRoleConfigured.mockReturnValue(true);
    generateLink.mockResolvedValue({
      data: { properties: { hashed_token: "hashed-token-value" } },
      error: null,
    });
    sendPasswordResetEmail.mockResolvedValue({ ok: true });
    resetPasswordForEmail.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends recovery email for requests under the limit", async () => {
    const { response, body } = await postForgotPassword("under-limit@example.com");

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(generateLink).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("returns the same success shape when the IP limit is reached", async () => {
    const ip = "203.0.113.20";
    const successBodies: unknown[] = [];

    for (let i = 0; i < 5; i += 1) {
      const { response, body } = await postForgotPassword(
        `ip-limit-${i}@example.com`,
        ip,
      );
      expect(response.status).toBe(200);
      successBodies.push(body);
    }

    const limited = await postForgotPassword("ip-limit-final@example.com", ip);

    expect(limited.response.status).toBe(200);
    expect(limited.body).toEqual({ ok: true });
    for (const body of successBodies) {
      expect(body).toEqual({ ok: true });
      expect(body).toEqual(limited.body);
    }
    expect(generateLink).toHaveBeenCalledTimes(5);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(5);
  });

  it("returns the same success shape when the email limit is reached", async () => {
    const email = "email-limit@example.com";
    const ip = "203.0.113.21";

    const first = await postForgotPassword(email, ip);
    const second = await postForgotPassword(email, ip);
    const third = await postForgotPassword(email, ip);
    const limited = await postForgotPassword(email, ip);

    expect(first.body).toEqual({ ok: true });
    expect(second.body).toEqual({ ok: true });
    expect(third.body).toEqual({ ok: true });
    expect(limited.response.status).toBe(200);
    expect(limited.body).toEqual({ ok: true });
    expect(limited.body).toEqual(first.body);
    expect(generateLink).toHaveBeenCalledTimes(3);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(3);
  });

  it("does not call Supabase or Resend when rate-limited by IP", async () => {
    const ip = "203.0.113.22";

    for (let i = 0; i < 5; i += 1) {
      await postForgotPassword(`blocked-ip-${i}@example.com`, ip);
    }

    await postForgotPassword("blocked-ip-final@example.com", ip);

    expect(generateLink).toHaveBeenCalledTimes(5);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(5);
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("does not call Supabase or Resend when rate-limited by email", async () => {
    const email = "blocked-email@example.com";

    await postForgotPassword(email, "203.0.113.23");
    await postForgotPassword(email, "203.0.113.24");
    await postForgotPassword(email, "203.0.113.25");
    await postForgotPassword(email, "203.0.113.26");

    expect(generateLink).toHaveBeenCalledTimes(3);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(3);
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("allows different IPs until the shared email limit is reached", async () => {
    const email = "cross-ip@example.com";

    await postForgotPassword(email, "203.0.113.30");
    await postForgotPassword(email, "203.0.113.31");
    await postForgotPassword(email, "203.0.113.32");

    const limited = await postForgotPassword(email, "203.0.113.33");

    expect(limited.body).toEqual({ ok: true });
    expect(generateLink).toHaveBeenCalledTimes(3);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(3);
  });

  it("allows different emails on the same IP until the IP limit is reached", async () => {
    const ip = "203.0.113.40";

    for (let i = 0; i < 5; i += 1) {
      const { body } = await postForgotPassword(`many-${i}@example.com`, ip);
      expect(body).toEqual({ ok: true });
    }

    const limited = await postForgotPassword("many-final@example.com", ip);

    expect(limited.body).toEqual({ ok: true });
    expect(generateLink).toHaveBeenCalledTimes(5);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(5);
  });
});
