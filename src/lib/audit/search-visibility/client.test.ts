import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGoogleSerpScreenshot } from "./client";

describe("SERP screenshot response parsing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("downloads the documented tasks.result.items.image URL", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "test-login");
    vi.stubEnv("DATAFORSEO_PASSWORD", "test-password");
    const imageBytes = new Uint8Array([137, 80, 78, 71]);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status_code: 20000, tasks: [{ status_code: 20000, result: [{ items: [{ image: "https://api.dataforseo.com/cdn/s/example" }] }] }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(imageBytes, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchGoogleSerpScreenshot("organic-task-id")).resolves.toEqual(Buffer.from(imageBytes));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.dataforseo.com/cdn/s/example");
  });
});
