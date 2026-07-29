import { describe, expect, it, vi, afterEach } from "vitest";
import { buildBrandedConfirmInviteUrl } from "@/lib/auth/branded-invite-flow";

describe("createClientPortalAccessLink branded URLs", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses hashed_token when branded flow flag is enabled", async () => {
    vi.stubEnv("SIGNALWORKS_BRANDED_INVITE_FLOW", "true");

    const generateLink = vi.fn().mockResolvedValue({
      data: {
        user: { id: "user-1" },
        properties: {
          hashed_token: "secure-hash-only",
          action_link:
            "https://project.supabase.co/auth/v1/verify?type=invite&token=secure-hash-only",
        },
      },
      error: null,
    });

    const listUsers = vi
      .fn()
      .mockResolvedValue({ data: { users: [] }, error: null });

    const supabase = {
      auth: {
        admin: {
          generateLink,
          listUsers,
        },
      },
    } as unknown as Parameters<
      typeof import("@/lib/admin/client-invite-link").createClientPortalAccessLink
    >[0];

    const { createClientPortalAccessLink } = await import(
      "@/lib/admin/client-invite-link"
    );

    const result = await createClientPortalAccessLink(supabase, {
      email: "mike@example.com",
      fullName: "Mike",
      tenantId: "tenant-1",
    });

    expect("inviteLink" in result).toBe(true);
    if (!("inviteLink" in result)) return;

    expect(result.inviteLink).toBe(
      buildBrandedConfirmInviteUrl(
        "https://clients.hiresignalworks.com",
        "secure-hash-only",
        "/auth/set-password",
      ),
    );
    expect(result.inviteLink).not.toContain("supabase.co");
  });
});
