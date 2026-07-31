import { describe, expect, it, vi } from "vitest";
import { runAudit } from "@/lib/audit/runner/run-audit";
import { createCollectorServices } from "@/lib/audit/collectors/services";
import type {
  AuditCollector,
  AuditRunPersistence,
  AuditRunProgress,
  RunAuditInput,
  SafeFetchResponse,
} from "@/lib/audit/types";

function createMemoryPersistence(): {
  persistence: AuditRunPersistence;
  progressSnapshots: AuditRunProgress[];
} {
  const progressSnapshots: AuditRunProgress[] = [];

  const persistence: AuditRunPersistence = {
    markRunning: vi.fn(async () => undefined),
    saveProgress: vi.fn(async (_runId, progress) => {
      progressSnapshots.push(structuredClone(progress));
    }),
    saveCollectorFindings: vi.fn(async () => undefined),
    saveCategoryScores: vi.fn(async () => undefined),
    saveRecommendations: vi.fn(async () => undefined),
    completeRun: vi.fn(async () => undefined),
    markRequestStatus: vi.fn(async () => undefined),
  };

  return { persistence, progressSnapshots };
}

const baseInput: RunAuditInput = {
  runId: "run-1",
  requestId: "req-1",
  tenantId: null,
  scope: {
    auditType: "public",
    scopeVersion: "public-1",
    includeOperationsInventory: false,
    includeEmailAuth: false,
    isPublicReport: true,
  },
  url: {
    input: "https://example.com",
    normalizedUrl: "https://example.com/",
    normalizedDomain: "example.com",
    hostname: "example.com",
  },
};

const mockHomepage: SafeFetchResponse = {
  url: "https://example.com",
  finalUrl: "https://example.com/",
  status: 200,
  headers: { "content-encoding": "gzip", "cache-control": "public, max-age=0" },
  bodyText: "<html><head><title>Example</title></head><body><h1>Hello</h1></body></html>",
  redirectChain: ["https://example.com/"],
};

describe("runAudit", () => {
  it("persists progress after each collector during synchronous execution", async () => {
    const { persistence, progressSnapshots } = createMemoryPersistence();

    const collectors: AuditCollector[] = [
      {
        key: "http_hosting",
        supports: () => true,
        collect: async () => ({
          collectorKey: "http_hosting",
          findings: [
            {
              category: "technical",
              checkKey: "technical.https.enforced",
              severity: "info",
              status: "pass",
              title: "HTTPS is used",
              summary: "pass",
              sourceType: "automated",
              sourceLabel: "Automated website check",
            },
          ],
        }),
      },
      {
        key: "metadata",
        supports: () => true,
        collect: async () => ({
          collectorKey: "metadata",
          findings: [],
        }),
      },
    ];

    const outcome = await runAudit(baseInput, {
      persistence,
      collectors,
      collectorServices: createCollectorServices({
        url: baseInput.url,
        fetchPage: vi.fn(async () => mockHomepage),
      }),
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(outcome.status).toBe("succeeded");
    expect(progressSnapshots.length).toBeGreaterThan(0);
    expect(persistence.markRunning).toHaveBeenCalledOnce();
    expect(persistence.completeRun).toHaveBeenCalledOnce();
    expect(persistence.saveCategoryScores).toHaveBeenCalledOnce();
    expect(persistence.saveRecommendations).toHaveBeenCalledOnce();

    const completeArgs = vi.mocked(persistence.completeRun).mock.calls[0]?.[1];
    expect(completeArgs?.progress.phase).toBe("complete");
  });
});
