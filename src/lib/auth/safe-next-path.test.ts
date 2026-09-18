import { describe, expect, it } from "vitest";
import {
  isSafeAppRelativePath,
  resolveAuthCallbackNextPath,
  resolvePostLoginRedirect,
} from "@/lib/auth/safe-next-path";

describe("safe next paths", () => {
  it("rejects protocol-relative, admin, and api paths", () => {
    expect(isSafeAppRelativePath("//evil.example")).toBe(false);
    expect(isSafeAppRelativePath("/admin")).toBe(false);
    expect(isSafeAppRelativePath("/admin/clients")).toBe(false);
    expect(isSafeAppRelativePath("/api/auth/login")).toBe(false);
    expect(isSafeAppRelativePath("https://evil.example")).toBe(false);
    expect(isSafeAppRelativePath("/overview")).toBe(true);
    expect(isSafeAppRelativePath("/offer")).toBe(true);
    expect(isSafeAppRelativePath("/billing")).toBe(true);
  });

  it("honors login next only after a services-tenant overview redirect", () => {
    expect(resolvePostLoginRedirect("/no-access", "/overview")).toBe("/no-access");
    expect(resolvePostLoginRedirect("/admin", "/overview")).toBe("/admin");
    expect(resolvePostLoginRedirect("/overview", "/admin")).toBe("/overview");
    expect(resolvePostLoginRedirect("/overview", "/offer")).toBe("/offer");
  });

  it("allowlists auth callback next paths", () => {
    expect(resolveAuthCallbackNextPath("/admin", "invite").path).toBe(
      "/auth/set-password",
    );
    expect(resolveAuthCallbackNextPath("//evil.example", "invite").path).toBe(
      "/auth/set-password",
    );
    expect(resolveAuthCallbackNextPath("/offer", "magiclink").path).toBe("/offer");
    expect(resolveAuthCallbackNextPath(null, "recovery")).toEqual({
      path: "/auth/reset-password",
      isRecovery: true,
    });
  });
});
