import { describe, expect, it } from "vitest";
import { getClientVisibleOfferDescription } from "@/lib/offers/client-offer-copy";

describe("getClientVisibleOfferDescription", () => {
  it("hides internal invite-flow notes", () => {
    expect(
      getClientVisibleOfferDescription(
        "Commercial agreement created during Invite Client. Source of truth: client_offer_items.",
      ),
    ).toBeNull();
  });

  it("returns client-written descriptions", () => {
    expect(
      getClientVisibleOfferDescription("Includes priority support through launch."),
    ).toBe("Includes priority support through launch.");
  });
});
