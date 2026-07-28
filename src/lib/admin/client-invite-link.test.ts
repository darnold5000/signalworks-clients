import { describe, expect, it } from "vitest";
import {
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
