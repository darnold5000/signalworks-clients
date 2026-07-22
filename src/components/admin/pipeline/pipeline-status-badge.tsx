"use client";

import { cn } from "@/lib/utils";
import {
  PIPELINE_STATUS_LABELS,
  pipelineStatusTone,
  type PipelineStatusTone,
} from "@/lib/pipeline/labels";
import type { PipelineStatus } from "@/lib/pipeline/types";

const TONE_CLASSES: Record<PipelineStatusTone, string> = {
  neutral: "bg-background text-muted",
  blue: "bg-blue-50 text-blue-700",
  purple: "bg-purple-50 text-purple-700",
  warning: "bg-amber-50 text-warning",
  orange: "bg-orange-50 text-orange-700",
  success: "bg-emerald-50 text-success",
  danger: "bg-red-50 text-danger",
};

export function PipelineStatusBadge({
  status,
  className,
}: {
  status: PipelineStatus;
  className?: string;
}) {
  const tone = pipelineStatusTone(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {PIPELINE_STATUS_LABELS[status]}
    </span>
  );
}
