import type { OperationsHealthStatus } from "@/lib/client-health/constants";
import type { UptimeRobotMonitor } from "@/lib/client-health/uptimerobot/types";

/**
 * UptimeRobot monitor status codes (v2 getMonitors).
 * @see https://uptimerobot.com/api/
 */
export function mapUptimeRobotMonitorStatus(
  statusCode: number,
): OperationsHealthStatus {
  switch (statusCode) {
    case 2:
      return "healthy";
    case 9:
      return "critical";
    case 8:
      return "warning";
    case 0:
      return "warning";
    case 1:
      return "unknown";
    default:
      return "unknown";
  }
}

export function websiteLabelFromStatus(
  status: OperationsHealthStatus,
): string {
  switch (status) {
    case "healthy":
      return "Online";
    case "critical":
      return "Down";
    case "warning":
      return "Degraded";
    case "unknown":
      return "Unknown";
    case "not_configured":
      return "Not configured";
  }
}

export function buildUptimeRobotSnapshot(
  monitor: UptimeRobotMonitor | null,
  monitorId: string | null,
): Record<string, unknown> {
  if (!monitorId) {
    return { configured: false };
  }
  if (!monitor) {
    return {
      configured: true,
      monitor_id: monitorId,
      found: false,
    };
  }
  return {
    configured: true,
    monitor_id: monitor.id,
    found: true,
    friendly_name: monitor.friendly_name,
    url: monitor.url,
    raw_status: monitor.status,
    average_response_time_ms: monitor.average_response_time,
    uptime_ratio_30d: monitor.uptime_ratio_30d,
    uptime_ratio_7d: monitor.uptime_ratio_7d,
    uptime_ratio_24h: monitor.uptime_ratio_24h,
    uptime_ratio_all_time: monitor.uptime_ratio_all_time,
    last_check_time: monitor.last_check_time,
  };
}
