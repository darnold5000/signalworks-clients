import { automatedFinding } from "@/lib/audit/collectors/shared/finding";
import { extractJsonLdBlocks } from "@/lib/audit/collectors/shared/html-parse";
import type { AuditCollector, AuditFindingInput } from "@/lib/audit/types";

const COLLECTOR_KEY = "structured_data";

const SCHEMA_TYPES = [
  { key: "organization", types: ["Organization"], category: "seo" as const },
  { key: "localbusiness", types: ["LocalBusiness", "HomeAndConstructionBusiness", "ProfessionalService"], category: "local_seo" as const },
  { key: "service", types: ["Service"], category: "seo" as const },
  { key: "faq", types: ["FAQPage"], category: "aeo" as const },
  { key: "breadcrumb", types: ["BreadcrumbList"], category: "seo" as const },
  { key: "website", types: ["WebSite"], category: "seo" as const },
];

function flattenNodes(node: unknown): Array<Record<string, unknown>> {
  if (!node || typeof node !== "object") return [];
  const record = node as Record<string, unknown>;
  const graph = record["@graph"];
  if (Array.isArray(graph)) {
    return graph.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
  }
  return [record];
}

function nodeTypes(node: Record<string, unknown>): string[] {
  const typeValue = node["@type"];
  if (typeof typeValue === "string") return [typeValue];
  if (Array.isArray(typeValue)) {
    return typeValue.filter((value): value is string => typeof value === "string");
  }
  return [];
}

function hasType(nodes: Array<Record<string, unknown>>, expected: string[]): boolean {
  return nodes.some((node) => nodeTypes(node).some((type) => expected.includes(type)));
}

export const structuredDataCollector: AuditCollector = {
  key: COLLECTOR_KEY,
  supports: () => true,

  async collect(context) {
    const findings: AuditFindingInput[] = [];
    const homepage = await context.services.getHomepage();

    if (!homepage) {
      return {
        collectorKey: COLLECTOR_KEY,
        findings: [
          automatedFinding({
            category: "seo",
            checkKey: "seo.schema.unavailable",
            severity: "medium",
            status: "unavailable",
            title: "Structured data could not be analyzed",
            summary: "Homepage HTML was not available for JSON-LD checks.",
          }),
        ],
        errorCode: "homepage_unavailable",
      };
    }

    const blocks = extractJsonLdBlocks(homepage.bodyText);
    const nodes = blocks.flatMap((block) => flattenNodes(block));

    if (nodes.length === 0) {
      findings.push(
        automatedFinding({
          category: "seo",
          checkKey: "seo.schema.json_ld.missing",
          severity: "medium",
          status: "warning",
          title: "No JSON-LD structured data found",
          summary: "No application/ld+json blocks were detected on the homepage.",
        }),
      );
    } else {
      findings.push(
        automatedFinding({
          category: "seo",
          checkKey: "seo.schema.json_ld.present",
          severity: "info",
          status: "pass",
          title: "JSON-LD structured data found",
          summary: `${nodes.length} structured data node(s) were detected.`,
          evidenceJson: { nodeCount: nodes.length },
        }),
      );
    }

    for (const schema of SCHEMA_TYPES) {
      const present = hasType(nodes, schema.types);
      findings.push(
        automatedFinding({
          category: schema.category,
          checkKey: `seo.${schema.key}_schema.${present ? "present" : "missing"}`,
          severity: present ? "info" : schema.key === "localbusiness" ? "medium" : "low",
          status: present ? "pass" : "warning",
          title: present
            ? `${schema.types[0]} schema detected`
            : `${schema.types[0]} schema not detected`,
          summary: present
            ? `At least one ${schema.types.join("/")} JSON-LD node was found.`
            : `No ${schema.types.join("/")} JSON-LD node was found on the homepage.`,
        }),
      );
    }

    const localBusinessNode = nodes.find((node) =>
      nodeTypes(node).some((type) =>
        ["LocalBusiness", "HomeAndConstructionBusiness", "ProfessionalService"].includes(type),
      ),
    );

    if (localBusinessNode) {
      const address = localBusinessNode.address;
      const phone = localBusinessNode.telephone;
      const areaServed = localBusinessNode.areaServed;
      const sameAs = localBusinessNode.sameAs;

      findings.push(
        automatedFinding({
          category: "local_seo",
          checkKey: "seo.localbusiness_schema.address",
          severity: address ? "info" : "medium",
          status: address ? "pass" : "warning",
          title: address ? "LocalBusiness address present" : "LocalBusiness address missing",
          summary: address
            ? "The LocalBusiness schema includes address information."
            : "The LocalBusiness schema does not include address information.",
        }),
        automatedFinding({
          category: "local_seo",
          checkKey: "seo.localbusiness_schema.phone",
          severity: phone ? "info" : "medium",
          status: phone ? "pass" : "warning",
          title: phone ? "LocalBusiness phone present" : "LocalBusiness phone missing",
          summary: phone
            ? "The LocalBusiness schema includes a phone number."
            : "The LocalBusiness schema does not include a phone number.",
        }),
        automatedFinding({
          category: "local_seo",
          checkKey: "seo.localbusiness_schema.service_area",
          severity: areaServed ? "info" : "low",
          status: areaServed ? "pass" : "warning",
          title: areaServed
            ? "LocalBusiness service area present"
            : "LocalBusiness service area missing",
          summary: areaServed
            ? "The LocalBusiness schema includes service area information."
            : "The LocalBusiness schema does not include service area information.",
        }),
        automatedFinding({
          category: "local_seo",
          checkKey: "seo.localbusiness_schema.same_as",
          severity: sameAs ? "info" : "low",
          status: sameAs ? "pass" : "warning",
          title: sameAs ? "LocalBusiness profile links present" : "LocalBusiness profile links missing",
          summary: sameAs
            ? "The LocalBusiness schema includes sameAs profile links."
            : "The LocalBusiness schema does not include sameAs profile links.",
        }),
      );
    }

    return {
      collectorKey: COLLECTOR_KEY,
      findings,
      evidence: {
        jsonLdBlockCount: blocks.length,
        nodeCount: nodes.length,
      },
    };
  },
};
