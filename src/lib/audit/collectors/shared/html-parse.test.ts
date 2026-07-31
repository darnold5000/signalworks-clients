import { describe, expect, it } from "vitest";
import {
  extractCanonicalUrl,
  extractJsonLdBlocks,
  extractMetaContent,
  extractTitle,
} from "@/lib/audit/collectors/shared/html-parse";

describe("html-parse", () => {
  it("extracts title and meta description", () => {
    const html = `<html><head>
      <title>Test Company</title>
      <meta name="description" content="We help local businesses grow." />
    </head></html>`;

    expect(extractTitle(html)).toBe("Test Company");
    expect(extractMetaContent(html, "description")).toBe(
      "We help local businesses grow.",
    );
  });

  it("extracts canonical and JSON-LD", () => {
    const html = `<html><head>
      <link rel="canonical" href="https://example.com/" />
      <script type="application/ld+json">{"@type":"Organization","name":"Example"}</script>
    </head></html>`;

    expect(extractCanonicalUrl(html)).toBe("https://example.com/");
    const blocks = extractJsonLdBlocks(html);
    expect(blocks).toHaveLength(1);
    expect((blocks[0] as { name?: string }).name).toBe("Example");
  });
});
