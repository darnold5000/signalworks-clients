import { describe, expect, it } from "vitest";
import { formatAuthInviteError } from "@/lib/admin/client-invite-link";

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
