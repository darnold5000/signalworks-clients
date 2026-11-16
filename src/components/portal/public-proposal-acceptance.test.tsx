import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicProposalAcceptance } from "@/components/portal/public-proposal-acceptance";

describe("PublicProposalAcceptance", () => {
  it("links the terms and statement of work from the acceptance checkboxes", () => {
    const html = renderToStaticMarkup(
      <PublicProposalAcceptance
        token="token"
        recipientName="Ada Client"
        recipientEmail="ada@example.com"
        requiresTerms
        requiresSow
        termsHref="/proposal/token/terms"
        sowHref="/proposal/token/sow"
        proposalOnly={false}
      />,
    );

    expect(html).toContain('href="/proposal/token/terms"');
    expect(html).toContain('href="/proposal/token/sow"');
    expect(html).toContain("I agree to the");
  });
});