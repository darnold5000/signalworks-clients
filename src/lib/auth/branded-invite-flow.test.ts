import { describe, expect, it } from "vitest";
import {
  buildBrandedConfirmInviteUrl,
  inviteErrorPath,
  mapVerifyOtpFailureToReason,
  resolveInviteNextPath,
} from "@/lib/auth/branded-invite-flow";

describe("branded invite flow helpers", () => {
  it("builds confirm-invite URLs on the portal origin", () => {
    const url = buildBrandedConfirmInviteUrl(
      "https://clients.hiresignalworks.com",
      "abc123hash",
      "/auth/set-password",
    );
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://clients.hiresignalworks.com");
    expect(parsed.pathname).toBe("/auth/confirm-invite");
    expect(parsed.searchParams.get("token_hash")).toBe("abc123hash");
    expect(parsed.searchParams.get("type")).toBe("invite");
    expect(parsed.searchParams.get("next")).toBe("/auth/set-password");
    expect(url).not.toContain("supabase.co");
  });

  it("rejects unsafe next paths", () => {
    expect(resolveInviteNextPath("https://evil.example")).toBe(
      "/auth/set-password",
    );
    expect(resolveInviteNextPath("//evil")).toBe("/auth/set-password");
    expect(resolveInviteNextPath("/auth/set-password")).toBe(
      "/auth/set-password",
    );
  });

  it("maps OTP failures to safe reasons", () => {
    expect(mapVerifyOtpFailureToReason("Token has expired")).toBe("expired");
    expect(mapVerifyOtpFailureToReason("Email link is invalid")).toBe(
      "invalid-link",
    );
  });

  it("builds invite error paths without leaking tokens", () => {
    expect(inviteErrorPath("expired")).toBe(
      "/auth/invite-error?reason=expired",
    );
  });
});
