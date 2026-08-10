import { describe, expect, it } from "vitest";
import {
  formatMilliseconds,
  presentCustomerFinding,
  presentCustomerRecommendation,
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
});
