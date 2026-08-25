import { describe, expect, it } from "vitest";
import {
  buildBrandedConfirmInviteUrl,
  buildBrandedConfirmRecoveryUrl,
  inviteErrorPath,
  mapVerifyOtpFailureToReason,
  recoveryLinkErrorPath,
  resolveInviteNextPath,
  resolveRecoveryNextPath,
} from "@/lib/auth/branded-invite-flow";
import { recoveryRedirectUrl } from "@/lib/site";

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

  it("builds confirm-recovery URLs on the portal origin", () => {
    const url = buildBrandedConfirmRecoveryUrl(
      "https://clients.hiresignalworks.com",
      "recoveryhash",
    );
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://clients.hiresignalworks.com");
    expect(parsed.pathname).toBe("/auth/confirm-recovery");
    expect(parsed.searchParams.get("token_hash")).toBe("recoveryhash");
    expect(parsed.searchParams.get("type")).toBe("recovery");
    expect(parsed.searchParams.get("next")).toBe("/auth/reset-password");
    expect(url).not.toContain("supabase.co");
  });

  it("rejects unsafe invite next paths", () => {
    expect(resolveInviteNextPath("https://evil.example")).toBe(
      "/auth/set-password",
    );
    expect(resolveInviteNextPath("//evil")).toBe("/auth/set-password");
    expect(resolveInviteNextPath("/auth/set-password")).toBe(
      "/auth/set-password",
    );
  });

  it("rejects unsafe recovery next paths", () => {
    expect(resolveRecoveryNextPath("https://evil.example")).toBe(
      "/auth/reset-password",
    );
    expect(resolveRecoveryNextPath("/auth/reset-password")).toBe(
      "/auth/reset-password",
    );
  });

  it("maps OTP failures to safe reasons", () => {
    expect(mapVerifyOtpFailureToReason("Token has expired")).toBe("expired");
    expect(mapVerifyOtpFailureToReason("Email link is invalid")).toBe(
      "invalid-link",
    );
  });

  it("uses direct reset-password redirect for legacy Supabase emails", () => {
    expect(recoveryRedirectUrl("https://clients.hiresignalworks.com")).toBe(
      "https://clients.hiresignalworks.com/auth/reset-password",
    );
  });
});
