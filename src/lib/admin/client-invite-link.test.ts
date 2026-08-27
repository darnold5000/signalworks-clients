import { describe, expect, it, vi } from "vitest";
import {
  createProposalPortalLink,
  formatAuthInviteError,
  userHasSignedIn,
} from "@/lib/admin/client-invite-link";

describe("userHasSignedIn", () => {
  it("treats DAWG-style users as signed in even with portal invited_at", () => {
    expect(
      userHasSignedIn({
        id: "x",
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: "",
        invited_at: "2026-01-01T00:00:00Z",
        last_sign_in_at: "2026-02-01T00:00:00Z",
      }),
    ).toBe(true);
  });
});

describe("formatAuthInviteError", () => {
  const redirect =
    "https://clients.hiresignalworks.com/auth/callback?next=%2Fauth%2Fset-password";

  it("explains duplicate auth users", () => {
    expect(
      formatAuthInviteError(
        "A user with this email address has already been registered",
        redirect,
      ),
    ).toMatch(/already has a portal account/i);
  });

  it("explains redirect URL problems", () => {
    expect(
      formatAuthInviteError("Invalid redirect URL", redirect),
    ).toContain(redirect);
  });
});

describe("createProposalPortalLink", () => {
  it("uses a durable login URL for an existing password user", async () => {
    const generateLink = vi.fn();
    const supabase = {
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({
            data: {
              users: [{ id: "user-1", email: "mike@example.com" }],
            },
            error: null,
          }),
          getUserById: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: "user-1",
                user_metadata: { password_set: true },
              },
            },
            error: null,
          }),
          generateLink,
        },
      },
    } as unknown as Parameters<typeof createProposalPortalLink>[0];

    const result = await createProposalPortalLink(supabase, {
      email: "Mike@example.com",
      fullName: "Mike",
      tenantId: "tenant-1",
    });

    expect(result).toEqual({
      inviteLink: "https://clients.hiresignalworks.com/login?next=%2Foffer",
      userId: "user-1",
      linkType: "login",
    });
    expect(generateLink).not.toHaveBeenCalled();
  });
});
