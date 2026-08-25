import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthTokensRedirectUrl } from "@/lib/auth/hash-session";

describe("getAuthTokensRedirectUrl", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      location: {
        search: "",
        hash: "",
      },
    });
  });

  it("routes recovery token_hash to confirm-recovery", () => {
    window.location.search =
      "?token_hash=abc&type=recovery&next=/auth/reset-password";
    window.location.hash = "";
    expect(getAuthTokensRedirectUrl()).toBe(
      "/auth/confirm-recovery?token_hash=abc&type=recovery&next=/auth/reset-password",
    );
  });

  it("routes recovery hash tokens to reset-password", () => {
    window.location.search = "";
    window.location.hash =
      "#access_token=at&refresh_token=rt&type=recovery";
    expect(getAuthTokensRedirectUrl()).toBe(
      "/auth/reset-password#access_token=at&refresh_token=rt&type=recovery",
    );
  });

  it("routes invite codes to callback", () => {
    window.location.search = "?code=pkce-code&next=/auth/set-password";
    window.location.hash = "";
    expect(getAuthTokensRedirectUrl()).toBe(
      "/auth/callback?code=pkce-code&next=/auth/set-password",
    );
  });
});
