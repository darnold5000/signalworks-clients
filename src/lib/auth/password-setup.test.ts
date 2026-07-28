import { describe, expect, it } from "vitest";
import { userNeedsPasswordSetup } from "@/lib/auth/password-setup";

describe("userNeedsPasswordSetup", () => {
  const base = {
    id: "x",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "",
  };

  it("requires setup for fresh invite with no sign-in yet", () => {
    expect(
      userNeedsPasswordSetup({
        ...base,
        invited_at: "2026-07-28T12:00:00Z",
        last_sign_in_at: null,
      } as never),
    ).toBe(true);
  });

  it("skips setup for shared-auth user who signed in before portal invite", () => {
    expect(
      userNeedsPasswordSetup({
        ...base,
        invited_at: "2026-07-28T12:00:00Z",
        last_sign_in_at: "2026-06-01T12:00:00Z",
      } as never),
    ).toBe(false);
  });

  it("skips setup when password_set is true", () => {
    expect(
      userNeedsPasswordSetup({
        ...base,
        invited_at: "2026-07-28T12:00:00Z",
        last_sign_in_at: "2026-07-28T12:00:01Z",
        user_metadata: { password_set: true },
      } as never),
    ).toBe(false);
  });
});
