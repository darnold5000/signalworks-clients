import { describe, expect, it } from "vitest";
import { analyzeAeoReadiness } from "./analyze";

describe("AI & Answer Readiness", () => {
  it("evaluates identity, questions, structure, and malformed JSON-LD deterministically", () => {
    const snapshot = analyzeAeoReadiness({
      businessName: "Example Financial",
      market: "Indianapolis, IN",
      html: `<html><head><title>Example Financial</title><link rel="canonical" href="https://example.com"><script type="application/ld+json">{bad json}</script></head><body><h1>Financial planning in Indianapolis</h1><h2>Financial planning services</h2><p>We provide financial planning and retirement planning for families. Visit 123 Main Street, Indianapolis, IN 46204. Call (317) 555-1212 or email hello@example.com.</p><h2>How do I get started?</h2><p>Schedule an introductory conversation with our team.</p><a href="/contact">Contact our team</a><a href="/services">Services</a></body></html>`,
    });
    expect(snapshot.score).toBeGreaterThanOrEqual(0);
    expect(snapshot.categories).toHaveLength(8);
    expect(snapshot.questionCoverage.total).toBeGreaterThan(0);
    expect(snapshot.evidence.websiteLocationEvidence).toBe(true);
  });

  it("does not treat the audit market alone as website location evidence", () => {
    const snapshot = analyzeAeoReadiness({ businessName: "Example", market: "Indianapolis, IN", html: "<html><head><title>Example</title></head><body><h1>Online software platform</h1></body></html>" });
    expect(snapshot.evidence.websiteLocationEvidence).toBe(false);
  });
});
