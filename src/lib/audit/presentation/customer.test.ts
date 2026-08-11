import { describe, expect, it } from "vitest";
import {
  formatMilliseconds,
  presentCustomerFinding,
  presentCustomerRecommendation,
  dedupeCustomerRecommendations,
} from "@/lib/audit/presentation/customer";

describe("customer audit presentation", () => {
  it("formats mobile LCP as readable seconds", () => {
    const result = presentCustomerFinding({
      checkKey: "pagespeed.mobile.lcp",
      category: "performance",
      title: "Mobile LCP: 16212.03396616326 ms",
      summary: "LCP exceeds threshold.",
    });
    expect(formatMilliseconds(16212.03396616326)).toBe("16.2 seconds");
    expect(result.customerTitle).toBe("Improve mobile loading speed");
    expect(result.customerTitle).not.toContain("LCP");
    expect(result.technicalValue).toBe("16.2 seconds");
  });

  it("translates CLS, LocalBusiness, and H1 findings", () => {
    expect(presentCustomerFinding({ checkKey: "cls", category: "performance", title: "Mobile CLS: 0.02275543354639132", summary: "Pass" }).customerTitle).toBe("Excellent page stability");
    expect(presentCustomerRecommendation({ category: "seo", title: "Add LocalBusiness structured data", description: "Schema not detected" }).customerTitle).toBe("Help Google understand your business");
    const h1 = presentCustomerRecommendation({ category: "seo", title: "Fix homepage H1 heading structure", description: "One H1 is recommended" });
    expect(h1.customerTitle).toBe("Clarify your homepage's main message");
    expect(h1.customerTitle).not.toContain("H1");
  });

  it("deduplicates recommendations that share customer-facing copy", () => {
    const recommendations = [
      {
        recommendationKey: "performance.improve_mobile_score",
        category: "performance",
        title: "Improve mobile performance score",
        description: "Address mobile performance opportunities.",
        priority: "high",
        supportingFindingKeys: ["performance.mobile.score"],
      },
      {
        recommendationKey: "performance.improve_mobile_lcp",
        category: "performance",
        title: "Improve mobile loading performance (LCP)",
        description: "Reduce Largest Contentful Paint on mobile.",
        priority: "high",
        supportingFindingKeys: ["performance.mobile.lcp"],
      },
      {
        recommendationKey: "seo.add_localbusiness_schema",
        category: "local_seo",
        title: "Add LocalBusiness structured data",
        description: "Add LocalBusiness JSON-LD.",
        priority: "high",
        supportingFindingKeys: ["seo.localbusiness_schema.missing"],
      },
      {
        recommendationKey: "aeo.strengthen_entity_information",
        category: "aeo",
        title: "Strengthen structured business and service information",
        description: "Clarify structured data so systems can understand the business.",
        priority: "high",
        supportingFindingKeys: ["aeo.structured_data"],
      },
      {
        recommendationKey: "seo.complete_localbusiness_schema",
        category: "local_seo",
        title: "Complete LocalBusiness structured data fields",
        description: "Complete LocalBusiness schema fields.",
        priority: "medium",
        supportingFindingKeys: ["seo.localbusiness_schema.address"],
      },
    ];

    const deduped = dedupeCustomerRecommendations(recommendations);
    expect(deduped).toHaveLength(2);
    expect(deduped.map((item) => item.recommendationKey)).toEqual([
      "performance.improve_mobile_lcp",
      "seo.add_localbusiness_schema",
    ]);
  });
});
