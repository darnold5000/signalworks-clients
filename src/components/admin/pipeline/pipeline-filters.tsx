"use client";

import {
  LEAD_TEMPERATURE_FILTER_OPTIONS,
  PIPELINE_FILTER_OPTIONS,
} from "@/lib/pipeline/labels";
import type { PipelineSortKey, PipelineStatus, LeadTemperature } from "@/lib/pipeline/types";
import type { HealthCheckFilter } from "@/lib/pipeline/query";

export type { HealthCheckFilter };

const SORT_OPTIONS: { key: PipelineSortKey; label: string }[] = [
  { key: "updated_at", label: "Updated" },
  { key: "business_name", label: "Business" },
  { key: "status", label: "Status" },
  { key: "lead_temperature", label: "Temperature" },
  { key: "last_contacted_at", label: "Last contact" },
];

export function PipelineFilters({
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  temperatureFilter,
  onTemperatureFilterChange,
  healthCheckFilter,
  onHealthCheckFilterChange,
  sortKey,
  onSortKeyChange,
  resultCount,
  totalCount,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  statusFilter: "all" | PipelineStatus;
  onStatusFilterChange: (value: "all" | PipelineStatus) => void;
  temperatureFilter: "all" | LeadTemperature;
  onTemperatureFilterChange: (value: "all" | LeadTemperature) => void;
  healthCheckFilter: HealthCheckFilter;
  onHealthCheckFilterChange: (value: HealthCheckFilter) => void;
  sortKey: PipelineSortKey;
  onSortKeyChange: (value: PipelineSortKey) => void;
  resultCount: number;
  totalCount: number;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search business or contact…"
          className="w-full max-w-md rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground lg:flex-1"
        />
        <p className="text-xs text-muted">
          {resultCount} of {totalCount} clients
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PIPELINE_FILTER_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onStatusFilterChange(option.key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === option.key
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Temperature</span>
          {LEAD_TEMPERATURE_FILTER_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onTemperatureFilterChange(option.key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                temperatureFilter === option.key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted">
            <span>Sort</span>
            <select
              value={sortKey}
              onChange={(event) =>
                onSortKeyChange(event.target.value as PipelineSortKey)
              }
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                  {option.key === "lead_temperature" ? " (Hot first)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-muted">
            <span>Health Check</span>
            <select
              value={healthCheckFilter}
              onChange={(event) =>
                onHealthCheckFilterChange(
                  event.target.value as HealthCheckFilter,
                )
              }
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
            >
              <option value="all">All</option>
              <option value="sent">Sent</option>
              <option value="not_sent">Not Sent</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
