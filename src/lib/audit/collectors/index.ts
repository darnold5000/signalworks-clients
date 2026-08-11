import { COLLECTOR_TIMEOUT_MS } from "@/lib/audit/constants";
import { homepageContentCollector } from "@/lib/audit/collectors/homepage-content";
import { httpHostingCollector } from "@/lib/audit/collectors/http-hosting";
import { metadataCollector } from "@/lib/audit/collectors/metadata";
import { operationsInventoryCollector } from "@/lib/audit/collectors/operations-inventory";
import { pagespeedCollector } from "@/lib/audit/collectors/pagespeed/collector";
import { robotsSitemapCollector } from "@/lib/audit/collectors/robots-sitemap";
import { structuredDataCollector } from "@/lib/audit/collectors/structured-data";
import { aeoReadinessCollector } from "@/lib/audit/aeo/collector";
import { wrapCollector } from "@/lib/audit/collectors/wrap-collector";
import type { AuditCollector } from "@/lib/audit/types";

const RAW_COLLECTORS: AuditCollector[] = [
  httpHostingCollector,
  metadataCollector,
  robotsSitemapCollector,
  structuredDataCollector,
  aeoReadinessCollector,
  homepageContentCollector,
  pagespeedCollector,
  operationsInventoryCollector,
];

export function createDefaultCollectors(): AuditCollector[] {
  return RAW_COLLECTORS.map((collector) =>
    wrapCollector(collector, {
      timeoutMs: COLLECTOR_TIMEOUT_MS[collector.key as keyof typeof COLLECTOR_TIMEOUT_MS] ?? 15_000,
    }),
  );
}

export function listRegisteredCollectorKeys(): string[] {
  return RAW_COLLECTORS.map((collector) => collector.key);
}
