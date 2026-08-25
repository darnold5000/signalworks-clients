import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockSignOut = vi.fn().mockResolvedValue({});
const mockExchangeCodeForSession = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      signOut: mockSignOut,
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  })),
}));

describe("auth/callback recovery failures", () => {
  beforeEach(() => {
    vi.resetModules();
    mockExchangeCodeForSession.mockResolvedValue({
      error: { message: "PKCE code verifier not found in storage" },
    });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("redirects recovery callback PKCE failures to reset-password error", async () => {
    const { GET } = await import("@/app/auth/callback/route");
    const request = new NextRequest(
      "http://localhost/auth/callback?code=invalid&next=/auth/reset-password",
    );
    const response = await GET(request);
    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/auth/reset-password");
    expect(location).toContain("error=recovery_link");
    expect(location).not.toContain("invite_link");
  });

  it("redirects invite callback failures to set-password invite error", async () => {
    const { GET } = await import("@/app/auth/callback/route");
    const request = new NextRequest(
      "http://localhost/auth/callback?code=invalid&next=/auth/set-password",
    );
    const response = await GET(request);
    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/auth/invite-error");
    expect(location).toContain("reason=invalid-link");
  });
});
