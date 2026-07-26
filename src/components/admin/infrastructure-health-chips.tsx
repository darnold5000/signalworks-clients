"use client";

import type { InfrastructureHealthChip } from "@/lib/technical/operations-inventory";

const toneClass: Record<NonNullable<InfrastructureHealthChip["tone"]>, string> = {
  neutral: "border-border bg-background",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
};

export function InfrastructureHealthChips({
  chips,
  max = 5,
}: {
  chips: InfrastructureHealthChip[];
  max?: number;
}) {
  if (chips.length === 0) {
    return <span className="text-xs text-muted">—</span>;
  }

  const visible = chips.slice(0, max);
  const overflow = chips.length - visible.length;

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((chip) => (
        <span
          key={chip.id}
          title={chip.detail}
          className={`cursor-help rounded border px-1.5 py-0.5 text-[10px] font-medium leading-tight ${toneClass[chip.tone ?? "neutral"]}`}
        >
          {chip.label}
        </span>
      ))}
      {overflow > 0 ? (
        <span className="text-[10px] text-muted">+{overflow}</span>
      ) : null}
    </div>
  );
}
