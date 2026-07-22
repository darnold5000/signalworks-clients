"use client";

import { PIPELINE_STATUS_LABELS } from "@/lib/pipeline/labels";
import { PIPELINE_STATUSES, type PipelineStatus } from "@/lib/pipeline/types";
import { cn } from "@/lib/utils";

export function PipelineStatusSelect({
  value,
  onChange,
  disabled,
  className,
  compact,
}: {
  value: PipelineStatus;
  onChange: (status: PipelineStatus) => void;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as PipelineStatus)}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "rounded-md border border-border bg-background text-sm outline-none focus:border-foreground disabled:opacity-50",
        compact ? "px-2 py-1 text-xs" : "w-full px-3 py-2.5",
        className,
      )}
    >
      {PIPELINE_STATUSES.map((status) => (
        <option key={status} value={status}>
          {PIPELINE_STATUS_LABELS[status]}
        </option>
      ))}
    </select>
  );
}
