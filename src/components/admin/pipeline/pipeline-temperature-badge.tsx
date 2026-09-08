"use client";

import { cn } from "@/lib/utils";
import { LEAD_TEMPERATURE_LABELS } from "@/lib/pipeline/labels";
import type { LeadTemperature } from "@/lib/pipeline/types";

const TEMPERATURE_CLASSES: Record<LeadTemperature, string> = {
  hot: "border-orange-200/80 bg-orange-50 text-orange-950 font-semibold",
  warm: "border-border bg-background text-foreground font-medium",
  lukewarm: "border-border bg-background text-muted font-medium",
  cold: "border-border bg-background text-muted font-medium",
  unknown: "border-dashed border-border bg-transparent text-muted font-medium",
};

export function PipelineTemperatureBadge({
  temperature,
  className,
}: {
  temperature: LeadTemperature;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs",
        TEMPERATURE_CLASSES[temperature],
        className,
      )}
    >
      {LEAD_TEMPERATURE_LABELS[temperature]}
    </span>
  );
}
