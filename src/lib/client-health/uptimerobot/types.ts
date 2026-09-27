export type UptimeRobotMonitor = {
  id: string;
  friendly_name: string;
  url: string;
  status: number;
  average_response_time: number | null;
  uptime_ratio_30d: number | null;
  uptime_ratio_7d: number | null;
  uptime_ratio_24h: number | null;
  uptime_ratio_all_time: number | null;
  last_check_time: number | null;
};

export type UptimeRobotListResult =
  | { ok: true; monitors: UptimeRobotMonitor[] }
  | { ok: false; error: string };

export type UptimeRobotFetchFn = (
  monitorIds?: string[],
) => Promise<UptimeRobotListResult>;
