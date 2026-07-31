import { describe, expect, it } from "vitest";
import { runCollectorsDryRun } from "@/lib/audit/execute-audit";

const live = process.env.LIVE_AUDIT === "1";

describe.runIf(live)("live collector dry-run", () => {
  it(
    "audits pestsolutionsindy.com",
    async () => {
      const result = await runCollectorsDryRun({
        rawUrl: "https://www.pestsolutionsindy.com/",
        auditType: "public",
      });

      expect(result.collectors.length).toBeGreaterThan(0);
      expect(result.collectors.some((c) => c.collectorKey === "http_hosting")).toBe(true);

      // Useful output for manual inspection when LIVE_AUDIT=1.
      console.log(
        JSON.stringify(
          {
            totalDurationMs: result.totalDurationMs,
            collectors: result.collectors.map((collector) => ({
              key: collector.collectorKey,
              durationMs: collector.durationMs,
              findingCount: collector.findingCount,
              errorCode: collector.errorCode,
              sampleFindings: collector.findings.slice(0, 5).map((finding) => ({
                checkKey: finding.checkKey,
                status: finding.status,
                title: finding.title,
              })),
            })),
          },
          null,
          2,
        ),
      );
    },
    120_000,
  );
});
