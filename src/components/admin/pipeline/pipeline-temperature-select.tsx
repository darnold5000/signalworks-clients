"use client";

import {
  LEAD_TEMPERATURE_DEFINITIONS,
  LEAD_TEMPERATURE_LABELS,
} from "@/lib/pipeline/labels";
import {
  LEAD_TEMPERATURES,
  type LeadTemperature,
} from "@/lib/pipeline/types";
import { cn } from "@/lib/utils";

export function PipelineTemperatureSelect({
  value,
  onChange,
  disabled,
  className,
  compact,
}: {
  value: LeadTemperature;
  onChange: (temperature: LeadTemperature) => void;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      aria-label="Lead temperature"
      title={LEAD_TEMPERATURE_DEFINITIONS[value]}
      onChange={(e) => onChange(e.target.value as LeadTemperature)}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "rounded-md border border-border bg-background text-sm outline-none focus:border-foreground disabled:opacity-50",
        value === "hot" && "font-semibold",
        compact ? "px-2 py-1 text-xs" : "w-full px-3 py-2.5",
        className,
      )}
    >
      {LEAD_TEMPERATURES.map((temperature) => (
        <option
          key={temperature}
          value={temperature}
          title={LEAD_TEMPERATURE_DEFINITIONS[temperature]}
        >
          {LEAD_TEMPERATURE_LABELS[temperature]}
        </option>
      ))}
    </select>
  );
}
