import { describe, expect, it } from "vitest";
import { buildOfferCheckoutReturnUrls } from "@/lib/offers/checkout-return-urls";

describe("offer checkout return URLs", () => {
  it("uses authenticated portal routes by default", () => {
    expect(
      buildOfferCheckoutReturnUrls({
        appUrl: "https://portal.test",
        finalStage: false,
      }),
    ).toEqual({
      success_url:
        "https://portal.test/billing/continue?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://portal.test/offer",
    });
  });

  it("uses public proposal routes when checkout started from a recipient token", () => {
    const token = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
    expect(
      buildOfferCheckoutReturnUrls({
        appUrl: "https://portal.test",
        finalStage: true,
        returnContext: { kind: "public_proposal", token },
      }),
    ).toEqual({
      success_url: `https://portal.test/proposal/${encodeURIComponent(token)}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://portal.test/proposal/${encodeURIComponent(token)}`,
    });
  });
});
