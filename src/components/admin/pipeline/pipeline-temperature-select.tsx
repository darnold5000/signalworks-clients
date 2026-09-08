"use client";

import {
  LEAD_TEMPERATURE_DEFINITIONS,
  LEAD_TEMPERATURE_LABELS,
  leadTemperaturePillClass,
} from "@/lib/pipeline/labels";
import {
  LEAD_TEMPERATURES,
  isLeadTemperatureVisible,
  type LeadTemperature,
  type PipelineStatus,
} from "@/lib/pipeline/types";
import { PipelineFieldPill } from "./pipeline-field-pill";

export function PipelineTemperatureSelect({
  value,
  onChange,
  disabled,
  className,
}: {
  value: LeadTemperature;
  onChange: (temperature: LeadTemperature) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <PipelineFieldPill
      value={value}
      options={LEAD_TEMPERATURES}
      getLabel={(temperature) => LEAD_TEMPERATURE_LABELS[temperature]}
      getOptionTitle={(temperature) => LEAD_TEMPERATURE_DEFINITIONS[temperature]}
      getTriggerClassName={leadTemperaturePillClass}
      disabled={disabled}
      ariaLabel="Lead temperature"
      title={LEAD_TEMPERATURE_DEFINITIONS[value]}
      onChange={onChange}
      className={className}
    />
  );
}

export function PipelineTemperatureControl({
  status,
  value,
  onChange,
  disabled,
  empty = "dash",
  className,
}: {
  status: PipelineStatus;
  value: LeadTemperature;
  onChange: (temperature: LeadTemperature) => void;
  disabled?: boolean;
  empty?: "dash" | "hidden";
  className?: string;
}) {
  if (!isLeadTemperatureVisible(status)) {
    if (empty === "hidden") return null;
    return <span className="text-xs text-muted">—</span>;
  }

  return (
    <PipelineTemperatureSelect
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={className}
    />
  );
}
