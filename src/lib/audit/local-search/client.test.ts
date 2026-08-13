import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGoogleLocalResults, isValidLocalNoResultsTask } from "./client";

const noResultsPayload = {
  status_code: 20000,
  tasks: [{ id: "task-no-results", status_code: 40102, status_message: "No Search Results.", result: null }],
};

describe("DataForSEO Local Finder response handling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("recognizes only the documented no-results task condition", () => {
    expect(isValidLocalNoResultsTask({ status_code: 40102, status_message: "No Search Results.", result: null })).toBe(true);
    expect(isValidLocalNoResultsTask({ status_code: 40101, status_message: "No Search Results.", result: null })).toBe(false);
    expect(isValidLocalNoResultsTask({ status_code: 40102, status_message: "Task execution failed, please try to resubmit the task.", result: null })).toBe(false);
  });

  it("returns a valid empty result for documented no-results responses", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "test-login");
    vi.stubEnv("DATAFORSEO_PASSWORD", "test-password");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(noResultsPayload), { status: 200 })));

    await expect(fetchGoogleLocalResults({ keyword: "basketball training", locationCode: 1017305, locationName: "Sheridan,Indiana,United States" })).resolves.toEqual({ items: [], taskId: "task-no-results", resultDepth: 20 });
  });

  it.each([
    ["authentication", 40100, "You are not authorized to access this resource."],
    ["provider failure", 50000, "Internal Error."],
    ["unexpected task", 40103, "Task execution failed, please try to resubmit the task."],
  ])("still throws for %s task failures", async (_label, statusCode, statusMessage) => {
    vi.stubEnv("DATAFORSEO_LOGIN", "test-login");
    vi.stubEnv("DATAFORSEO_PASSWORD", "test-password");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status_code: 20000, tasks: [{ status_code: statusCode, status_message: statusMessage }] }), { status: 200 })));

    await expect(fetchGoogleLocalResults({ keyword: "basketball training", locationCode: 1017305, locationName: "Sheridan,Indiana,United States" })).rejects.toThrow(statusMessage);
  });

  it("still throws for HTTP failures and timeouts", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "test-login");
    vi.stubEnv("DATAFORSEO_PASSWORD", "test-password");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Unauthorized", { status: 401 })));
    await expect(fetchGoogleLocalResults({ keyword: "basketball training", locationCode: 1017305, locationName: "Sheridan,Indiana,United States" })).rejects.toThrow("DataForSEO local HTTP 401");

    vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("The operation was aborted", "AbortError"); }));
    await expect(fetchGoogleLocalResults({ keyword: "basketball training", locationCode: 1017305, locationName: "Sheridan,Indiana,United States" })).rejects.toThrow("The operation was aborted");
  });
});
