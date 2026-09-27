import { describe, expect, it, vi } from "vitest";
import {
  UPTIMEROBOT_CUSTOM_UPTIME_RATIOS,
  createUptimeRobotClient,
  mapRawMonitor,
  parseCustomUptimeRatios,
} from "@/lib/client-health/uptimerobot/client";

describe("UPTIMEROBOT_CUSTOM_UPTIME_RATIOS", () => {
  it("uses only day counts of at least 1 (no lifetime 0)", () => {
    expect(UPTIMEROBOT_CUSTOM_UPTIME_RATIOS).toBe("30-7-1");
    for (const part of UPTIMEROBOT_CUSTOM_UPTIME_RATIOS.split("-")) {
      expect(Number(part)).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("parseCustomUptimeRatios", () => {
  it("parses comma-separated ratios in 30-7-1 order (30d, 7d, 24h)", () => {
    expect(parseCustomUptimeRatios("99.9,99.5,100")).toEqual({
      uptime_30d: 99.9,
      uptime_7d: 99.5,
      uptime_24h: 100,
      uptime_all_time: null,
    });
  });
});

describe("createUptimeRobotClient", () => {
  it("sends custom_uptime_ratios as 30-7-1 day windows", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = String(init?.body ?? "");
      expect(body).toContain(
        `custom_uptime_ratios=${UPTIMEROBOT_CUSTOM_UPTIME_RATIOS}`,
      );
      expect(body).not.toMatch(/custom_uptime_ratios=[^&]*\b0\b/);
      return Response.json({ stat: "ok", monitors: [] });
    });
    const client = createUptimeRobotClient({
      apiKey: "test-key",
      fetchImpl,
    });
    await client.fetchMonitors();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("returns error when API stat is not ok", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        stat: "fail",
        error: { message: "Invalid api_key" },
      }),
    );
    const client = createUptimeRobotClient({
      apiKey: "test-key",
      fetchImpl,
    });
    const result = await client.fetchMonitors(["123"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Invalid api_key");
    }
  });

  it("maps monitor payload including uptime ratios", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        stat: "ok",
        monitors: [
          {
            id: 801234567,
            friendly_name: "MA5",
            url: "https://ma5performance.com/",
            status: 2,
            average_response_time: "412",
            custom_uptime_ratio: "99.99,99.98,100",
          },
        ],
      }),
    );
    const client = createUptimeRobotClient({
      apiKey: "test-key",
      fetchImpl,
    });
    const result = await client.fetchMonitors(["801234567"]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.monitors[0]).toMatchObject({
        id: "801234567",
        status: 2,
        average_response_time: 412,
        uptime_ratio_30d: 99.99,
        uptime_ratio_7d: 99.98,
        uptime_ratio_24h: 100,
        uptime_ratio_all_time: null,
      });
    }
  });
});

describe("mapRawMonitor", () => {
  it("returns null without id", () => {
    expect(mapRawMonitor({ status: 2 })).toBeNull();
  });
});
