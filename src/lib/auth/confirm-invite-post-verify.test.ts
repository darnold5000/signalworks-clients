import { describe, expect, it, vi } from "vitest";
import { afterInviteOtpVerified } from "@/lib/auth/confirm-invite-post-verify";

const fakeUser = {
  id: "user-1",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: "",
};

describe("afterInviteOtpVerified", () => {
  it("signs out when verifyOtp succeeded but portal membership is missing", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const getUser = vi.fn().mockResolvedValue({
      data: { user: fakeUser },
      error: null,
    });
    const resolvePortalAccess = vi.fn().mockResolvedValue({ ok: false });

    const result = await afterInviteOtpVerified({
      getUser,
      signOut,
      resolvePortalAccess,
    });

    expect(result).toEqual({ kind: "failure", reason: "not-authorized" });
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(resolvePortalAccess).toHaveBeenCalledWith("user-1");
  });

  it("does not sign out when membership is valid", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const getUser = vi.fn().mockResolvedValue({
      data: { user: fakeUser },
      error: null,
    });
    const resolvePortalAccess = vi
      .fn()
      .mockResolvedValue({ ok: true, tenantId: "tenant-1" });

    const result = await afterInviteOtpVerified({
      getUser,
      signOut,
      resolvePortalAccess,
    });

    expect(result).toEqual({ kind: "success", tenantId: "tenant-1" });
    expect(signOut).not.toHaveBeenCalled();
  });

  it("still succeeds when optional activity logging fails", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const onLinkVerified = vi.fn().mockRejectedValue(new Error("db unavailable"));

    const result = await afterInviteOtpVerified({
      getUser: vi.fn().mockResolvedValue({
        data: { user: fakeUser },
        error: null,
      }),
      signOut,
      resolvePortalAccess: vi
        .fn()
        .mockResolvedValue({ ok: true, tenantId: "tenant-1" }),
      onLinkVerified,
    });

    expect(result).toEqual({ kind: "success", tenantId: "tenant-1" });
    expect(onLinkVerified).toHaveBeenCalledWith("tenant-1", "user-1");
    expect(signOut).not.toHaveBeenCalled();
  });
});
