import { describe, expect, it, vi } from "vitest";
import {
  createUptimeRobotClient,
  mapRawMonitor,
  parseCustomUptimeRatios,
} from "@/lib/client-health/uptimerobot/client";

describe("parseCustomUptimeRatios", () => {
  it("parses comma-separated ratios in 30-7-1-0 order", () => {
    expect(parseCustomUptimeRatios("99.9,99.5,100,98")).toEqual({
      uptime_30d: 99.9,
      uptime_7d: 99.5,
      uptime_24h: 100,
      uptime_all_time: 98,
    });
  });
});

describe("createUptimeRobotClient", () => {
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
            custom_uptime_ratio: "99.99,99.98,100,99.9",
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
      });
    }
  });
});

describe("mapRawMonitor", () => {
  it("returns null without id", () => {
    expect(mapRawMonitor({ status: 2 })).toBeNull();
  });
});
