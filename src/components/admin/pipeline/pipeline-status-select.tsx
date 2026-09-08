"use client";

import { PIPELINE_STATUS_LABELS, pipelineStatusPillClass } from "@/lib/pipeline/labels";
import { PIPELINE_STATUSES, type PipelineStatus } from "@/lib/pipeline/types";
import { PipelineFieldPill } from "./pipeline-field-pill";

export function PipelineStatusSelect({
  value,
  onChange,
  disabled,
  className,
}: {
  value: PipelineStatus;
  onChange: (status: PipelineStatus) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <PipelineFieldPill
      value={value}
      options={PIPELINE_STATUSES}
      getLabel={(status) => PIPELINE_STATUS_LABELS[status]}
      getTriggerClassName={pipelineStatusPillClass}
      disabled={disabled}
      ariaLabel="Pipeline status"
      onChange={onChange}
      className={className}
    />
  );
}
