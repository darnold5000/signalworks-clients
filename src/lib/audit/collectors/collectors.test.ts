import { describe, expect, it } from "vitest";
import { metadataCollector } from "@/lib/audit/collectors/metadata";
import { structuredDataCollector } from "@/lib/audit/collectors/structured-data";
import { createCollectorServices } from "@/lib/audit/collectors/services";
import { createMockPageSpeedClient } from "@/lib/audit/collectors/pagespeed/client";
import type { AuditScope, SafeFetchResponse } from "@/lib/audit/types";

const scope: AuditScope = {
  auditType: "public",
  scopeVersion: "public-1",
  includeOperationsInventory: false,
  includeEmailAuth: false,
  isPublicReport: true,
};

const sampleHtml = `<!doctype html>
<html lang="en">
<head>
  <title>Pest Solutions Indy | Pest Control Indianapolis</title>
  <meta name="description" content="Professional pest control in Indianapolis and surrounding areas." />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="canonical" href="https://www.pestsolutionsindy.com/" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "Pest Solutions Indy",
    "telephone": "+1-317-555-0100",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Indianapolis",
      "addressRegion": "IN"
    }
  }
  </script>
</head>
<body>
  <h1>Pest Control in Indianapolis</h1>
  <a href="/services">Our Services</a>
  <a href="/contact">Contact Us</a>
  <a href="/privacy-policy">Privacy Policy</a>
</body>
</html>`;

const homepage: SafeFetchResponse = {
  url: "https://www.pestsolutionsindy.com",
  finalUrl: "https://www.pestsolutionsindy.com/",
  status: 200,
  headers: {
    "content-encoding": "gzip",
    "cache-control": "public, max-age=600",
    "strict-transport-security": "max-age=31536000",
  },
  bodyText: sampleHtml,
  redirectChain: [
    "https://www.pestsolutionsindy.com",
    "https://www.pestsolutionsindy.com/",
  ],
};

function createContext() {
  const services = createCollectorServices({
    url: {
      input: "https://www.pestsolutionsindy.com",
      normalizedUrl: "https://www.pestsolutionsindy.com/",
      normalizedDomain: "pestsolutionsindy.com",
      hostname: "www.pestsolutionsindy.com",
    },
    fetchPage: async () => homepage,
    pagespeedClient: createMockPageSpeedClient(),
  });
  services.primeHomepage(homepage);

  return {
    scope,
    url: services.url,
    tenantId: null,
    auditRequestId: "test",
    auditRunId: "test",
    services,
  };
}

describe("metadata collector", () => {
  it("extracts title, description, and h1 findings", async () => {
    const result = await metadataCollector.collect(createContext());
    const keys = result.findings.map((finding) => finding.checkKey);

    expect(keys).toContain("seo.title.present");
    expect(keys).toContain("seo.meta_description.present");
    expect(keys).toContain("seo.h1.count");
    expect(result.findings.find((f) => f.checkKey === "seo.h1.count")?.status).toBe("pass");
  });
});

describe("structured data collector", () => {
  it("detects LocalBusiness schema", async () => {
    const result = await structuredDataCollector.collect(createContext());
    expect(
      result.findings.some((finding) => finding.checkKey === "seo.localbusiness_schema.present"),
    ).toBe(true);
  });
});
