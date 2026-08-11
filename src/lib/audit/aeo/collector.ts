import { automatedFinding } from "@/lib/audit/collectors/shared/finding";
import type { AuditCollector, AuditFindingInput } from "@/lib/audit/types";
import { analyzeAeoReadiness } from "./analyze";

export const aeoReadinessCollector: AuditCollector = {
  key: "aeo_readiness",
  supports: () => true,
  async collect(context) {
    const homepage = await context.services.getHomepage();
    if (!homepage) return { collectorKey: "aeo_readiness", findings: [automatedFinding({ category: "aeo", checkKey: "aeo.readiness.unavailable", severity: "medium", status: "unavailable", title: "AI & Answer Readiness could not be analyzed", summary: "Homepage HTML was not available for readiness checks." })], errorCode: "homepage_unavailable" };
    const snapshot = analyzeAeoReadiness({ html: homepage.bodyText, businessName: context.businessName, market: context.market });
    const findings: AuditFindingInput[] = snapshot.categories.map((category) => automatedFinding({ category: "aeo", checkKey: `aeo.${category.key}`, severity: category.score < 40 ? "high" : category.score < 70 ? "medium" : "info", status: category.score >= 70 ? "pass" : "warning", title: `${category.label}: ${category.score}/100`, summary: category.evidence.join(" "), evidenceJson: { category: category.key, score: category.score, passed: category.passed, failed: category.failed } }));
    return { collectorKey: "aeo_readiness", findings, evidence: snapshot.evidence };
  },
};
