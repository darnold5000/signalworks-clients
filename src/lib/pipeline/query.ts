import {
  LEAD_TEMPERATURE_PRIORITY,
  isLeadTemperatureVisible,
  type ClientPipelineRecord,
  type LeadTemperature,
  type PipelineSortDirection,
  type PipelineSortKey,
  type PipelineStatus,
} from "@/lib/pipeline/types";

export type HealthCheckFilter = "all" | "sent" | "not_sent";

export type PipelineQueryFilters = {
  query: string;
  statusFilter: "all" | PipelineStatus;
  temperatureFilter: "all" | LeadTemperature;
  healthCheckFilter: HealthCheckFilter;
};

export function filterPipelineClients(
  clients: ClientPipelineRecord[],
  filters: PipelineQueryFilters,
): ClientPipelineRecord[] {
  const q = filters.query.trim().toLowerCase();
  return clients.filter((client) => {
    if (
      filters.statusFilter !== "all" &&
      client.status !== filters.statusFilter
    ) {
      return false;
    }
    if (filters.temperatureFilter !== "all") {
      if (!isLeadTemperatureVisible(client.status)) {
        return false;
      }
      if (client.lead_temperature !== filters.temperatureFilter) {
        return false;
      }
    }
    if (filters.healthCheckFilter === "sent" && !client.health_check_sent) {
      return false;
    }
    if (filters.healthCheckFilter === "not_sent" && client.health_check_sent) {
      return false;
    }
    if (!q) return true;
    const haystack = [
      client.business_name,
      client.contact_name,
      client.contact_email,
      client.phone,
      client.website_url,
      client.tags.join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function sortPipelineClients(
  clients: ClientPipelineRecord[],
  sortKey: PipelineSortKey,
  sortDirection: PipelineSortDirection,
): ClientPipelineRecord[] {
  const sorted = [...clients].sort((a, b) => {
    if (sortKey === "updated_at") {
      return (
        new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      );
    }
    if (sortKey === "last_contacted_at") {
      const aTime = a.last_contacted_at
        ? new Date(a.last_contacted_at).getTime()
        : 0;
      const bTime = b.last_contacted_at
        ? new Date(b.last_contacted_at).getTime()
        : 0;
      return aTime - bTime;
    }
    if (sortKey === "business_name") {
      return a.business_name.localeCompare(b.business_name);
    }
    if (sortKey === "lead_temperature") {
      return temperatureSortRank(a) - temperatureSortRank(b);
    }
    return a.status.localeCompare(b.status);
  });
  return sortDirection === "desc" ? sorted.reverse() : sorted;
}

export function defaultSortDirection(
  key: PipelineSortKey,
): PipelineSortDirection {
  return key === "updated_at" ? "desc" : "asc";
}

function temperatureSortRank(client: ClientPipelineRecord): number {
  if (!isLeadTemperatureVisible(client.status)) {
    return 5;
  }
  return LEAD_TEMPERATURE_PRIORITY[client.lead_temperature];
}
