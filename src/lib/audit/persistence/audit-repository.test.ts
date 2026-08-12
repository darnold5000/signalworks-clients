import { describe, expect, it, vi } from "vitest";
import { saveSearchVisibilitySnapshot } from "./audit-repository";

describe("Search Visibility diagnostic persistence", () => {
  it("persists phase, code, message, and query counts", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn(() => ({ upsert })) } as never;

    await saveSearchVisibilitySnapshot(supabase, "run-1", {
      status: "unavailable",
      score: null,
      businessName: "Example",
      city: "Indianapolis",
      state: "Indiana",
      locationName: "Indianapolis,Indiana,United States",
      results: [],
      summary: null,
      errorMessage: "Not enough validated customer search intents were measured.",
      checkedAt: new Date().toISOString(),
      enteredMarket: "Indianapolis, Indiana",
      locationCode: 1017146,
      auditedDomain: "example.com",
      resultDepth: 30,
      searchEngine: "google",
      diagnostics: {
        failurePhase: "organic_serp",
        failureCode: "organic_insufficient_coverage",
        failureMessage: "Only 2 of 8 discovery queries succeeded.",
        successfulQueryCount: 2,
        failedQueryCount: 6,
      },
      searchDemandDiagnostics: {
        providerRequestAttempted: true,
        providerHttpStatus: 401,
        providerTaskStatus: null,
        responseStatus: "failed",
        parseStatus: "not_attempted",
        resultCount: null,
        persistenceAttempted: false,
        persistenceStatus: "not_attempted",
        failurePhase: "provider_response",
        failureCode: "demand_provider_http_error",
        failureMessage: "DataForSEO demand HTTP 401",
      },
    });

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      audit_run_id: "run-1",
      error_message: "Not enough validated customer search intents were measured.",
      failure_phase: "organic_serp",
      failure_code: "organic_insufficient_coverage",
      failure_message: "Only 2 of 8 discovery queries succeeded.",
      successful_query_count: 2,
      failed_query_count: 6,
      demand_provider_request_attempted: true,
      demand_provider_http_status: 401,
      demand_provider_task_status: null,
      demand_response_status: "failed",
      demand_parse_status: "not_attempted",
      demand_result_count: null,
      demand_persistence_attempted: false,
      demand_persistence_status: "not_attempted",
      demand_failure_phase: "provider_response",
      demand_failure_code: "demand_provider_http_error",
      demand_failure_message: "DataForSEO demand HTTP 401",
    }), { onConflict: "audit_run_id" });
  });
});
