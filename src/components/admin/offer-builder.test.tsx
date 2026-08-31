import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OfferBuilder } from "@/components/admin/offer-builder";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("OfferBuilder proposal presentation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses proposal terminology and processor-neutral billing language", () => {
    const html = renderToStaticMarkup(
      <OfferBuilder
        tenantId="tenant-1"
        initialOffers={[]}
        contacts={[]}
        recipientDeliveries={[]}
      />,
    );

    expect(html).toContain("Create Proposal");
    expect(html).toContain("Proposal title");
    expect(html).toContain("Proposal summary");
    expect(html).toContain("Proposal scope");
    expect(html).toContain("Create &amp; Edit Proposal");
    expect(html).toContain("Online Payment / Subscription");
    expect(html).toContain("No proposals yet");
    expect(html).not.toContain("Create draft offer");
    expect(html).not.toContain("Stripe Checkout");
  });
});
