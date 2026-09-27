import type {
  UptimeRobotFetchFn,
  UptimeRobotListResult,
  UptimeRobotMonitor,
} from "@/lib/client-health/uptimerobot/types";

const UPTIMEROBOT_API_URL = "https://api.uptimerobot.com/v2/getMonitors";

/**
 * Hyphen-separated day counts for getMonitors `custom_uptime_ratios`.
 * UptimeRobot returns matching comma-separated ratios in the same order.
 * @see https://uptimerobot.com/api/ (getMonitors — custom_uptime_ratios)
 */
export const UPTIMEROBOT_CUSTOM_UPTIME_RATIOS = "30-7-1";

type RawMonitor = {
  id?: number | string;
  friendly_name?: string;
  url?: string;
  status?: number;
  average_response_time?: string | number;
  custom_uptime_ratio?: string;
  last_check_time?: number | string;
};

function parseRatio(value: string | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Order matches `custom_uptime_ratios=30-7-1` (30 days, 7 days, 1 day). */
export function parseCustomUptimeRatios(
  customUptimeRatio: string | undefined,
): {
  uptime_30d: number | null;
  uptime_7d: number | null;
  uptime_24h: number | null;
  uptime_all_time: number | null;
} {
  if (!customUptimeRatio?.trim()) {
    return {
      uptime_30d: null,
      uptime_7d: null,
      uptime_24h: null,
      uptime_all_time: null,
    };
  }
  const parts = customUptimeRatio.split(",").map((p) => p.trim());
  return {
    uptime_30d: parseRatio(parts[0]),
    uptime_7d: parseRatio(parts[1]),
    uptime_24h: parseRatio(parts[2]),
    uptime_all_time: parseRatio(parts[3]),
  };
}

export function mapRawMonitor(raw: RawMonitor): UptimeRobotMonitor | null {
  if (raw.id == null) return null;
  const ratios = parseCustomUptimeRatios(raw.custom_uptime_ratio);
  const avg =
    raw.average_response_time != null
      ? Number(raw.average_response_time)
      : null;

  return {
    id: String(raw.id),
    friendly_name: raw.friendly_name?.trim() || "Monitor",
    url: raw.url?.trim() || "",
    status: typeof raw.status === "number" ? raw.status : 1,
    average_response_time:
      avg != null && Number.isFinite(avg) ? Math.round(avg) : null,
    uptime_ratio_30d: ratios.uptime_30d,
    uptime_ratio_7d: ratios.uptime_7d,
    uptime_ratio_24h: ratios.uptime_24h,
    uptime_ratio_all_time: ratios.uptime_all_time,
    last_check_time:
      raw.last_check_time != null ? Number(raw.last_check_time) : null,
  };
}

export function createUptimeRobotClient(options: {
  apiKey: string | undefined;
  fetchImpl?: typeof fetch;
}): { fetchMonitors: UptimeRobotFetchFn; isConfigured: boolean } {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiKey = options.apiKey?.trim();

  async function fetchMonitors(
    monitorIds?: string[],
  ): Promise<UptimeRobotListResult> {
    if (!apiKey) {
      return {
        ok: false,
        error: "UptimeRobot is not configured (missing UPTIMEROBOT_API_KEY).",
      };
    }

    const body = new URLSearchParams({
      api_key: apiKey,
      format: "json",
      response_times: "1",
      custom_uptime_ratios: UPTIMEROBOT_CUSTOM_UPTIME_RATIOS,
    });
    if (monitorIds?.length) {
      body.set("monitors", monitorIds.join("-"));
    }

    try {
      const response = await fetchImpl(UPTIMEROBOT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      const payload = (await response.json()) as {
        stat?: string;
        error?: { message?: string; type?: string };
        monitors?: RawMonitor[];
      };

      if (!response.ok) {
        return {
          ok: false,
          error: payload.error?.message ?? `HTTP ${response.status}`,
        };
      }

      if (payload.stat !== "ok") {
        return {
          ok: false,
          error: payload.error?.message ?? "UptimeRobot request failed.",
        };
      }

      const monitors = (payload.monitors ?? [])
        .map(mapRawMonitor)
        .filter((m): m is UptimeRobotMonitor => m != null);

      return { ok: true, monitors };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not reach UptimeRobot.",
      };
    }
  }

  return {
    fetchMonitors,
    isConfigured: Boolean(apiKey),
  };
}

export function uptimeRobotClientFromEnv(fetchImpl?: typeof fetch) {
  return createUptimeRobotClient({
    apiKey: process.env.UPTIMEROBOT_API_KEY,
    fetchImpl,
  });
}
