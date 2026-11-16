import { describe, expect, it } from "vitest";
import {
  isPlatformTermsDocument,
  renderSignalWorksTosHtml,
  renderSignalWorksTosText,
  termsDocumentHtml,
} from "@/lib/legal/signal-works-tos";

describe("Signal Works terms of service", () => {
  it("renders the current agreement, including lists", () => {
    const html = renderSignalWorksTosHtml();

    expect(html).toContain("<h1>SIGNAL WORKS DIGITAL LLC</h1>");
    expect(html).toContain("<h1>TERMS OF SERVICE</h1>");
    expect(html).toContain("<h2>10. Website Ownership After Twelve Paid Months</h2>");
    expect(html).toContain("<h2>6. Ongoing Maintenance, Support, and Exclusive Management</h2>");
    expect(html).toContain("<h2>26. Cancellation — No Long-Term Commitment</h2>");
    expect(html).toContain("<strong>The Client may cancel at any time without a required advance notice period.</strong>");
    expect(html).toContain("Signal Works does not bill standard website change requests by the hour.");
    expect(html).toContain("https://hiresignalworks.com");
    expect(html).not.toContain(
      'THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE."',
    );
  });

  it("keeps the plain-text copy readable", () => {
    const text = renderSignalWorksTosText();
    expect(text).toContain("SIGNAL WORKS DIGITAL LLC");
    expect(text).toContain("twelve (12) fully paid monthly subscription periods");
    expect(text).not.toContain("**");
  });

  it("shows the current platform terms instead of a stored older copy", () => {
    const html = termsDocumentHtml({
      document_type: "terms_of_service",
      tenant_id: null,
      content_html: "<p>Old terms</p>",
    });

    expect(html).toContain("SIGNAL WORKS DIGITAL LLC");
    expect(html).not.toContain("Old terms");
    expect(
      isPlatformTermsDocument({
        document_type: "terms_of_service",
        tenant_id: null,
      }),
    ).toBe(true);
  });

  it("keeps a client-specific terms document", () => {
    const html = termsDocumentHtml({
      document_type: "terms_of_service",
      tenant_id: "tenant-1",
      content_html: "<p>Custom terms</p>",
    });

    expect(html).toBe("<p>Custom terms</p>");
  });
});
