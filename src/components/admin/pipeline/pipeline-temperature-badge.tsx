"use client";

import { cn } from "@/lib/utils";
import { LEAD_TEMPERATURE_LABELS, leadTemperaturePillClass } from "@/lib/pipeline/labels";
import type { LeadTemperature } from "@/lib/pipeline/types";

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
        "inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        leadTemperaturePillClass(temperature),
        className,
      )}
    >
      {LEAD_TEMPERATURE_LABELS[temperature]}
    </span>
  );
}
