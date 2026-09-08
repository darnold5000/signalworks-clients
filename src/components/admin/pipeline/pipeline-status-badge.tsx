"use client";

import { cn } from "@/lib/utils";
import {
  PIPELINE_STATUS_LABELS,
  pipelineStatusPillClass,
} from "@/lib/pipeline/labels";
import type { PipelineStatus } from "@/lib/pipeline/types";

export function PipelineStatusBadge({
  status,
  className,
}: {
  status: PipelineStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        pipelineStatusPillClass(status),
        className,
      )}
    >
      {PIPELINE_STATUS_LABELS[status]}
    </span>
  );
}
