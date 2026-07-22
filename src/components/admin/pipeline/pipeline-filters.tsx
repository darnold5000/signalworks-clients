"use client";

import { PIPELINE_FILTER_OPTIONS } from "@/lib/pipeline/labels";
import type { PipelineStatus } from "@/lib/pipeline/types";

export function PipelineFilters({
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  resultCount,
  totalCount,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  statusFilter: "all" | PipelineStatus;
  onStatusFilterChange: (value: "all" | PipelineStatus) => void;
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
    </div>
  );
}
