"use client";

import { CalendarDays } from "lucide-react";
import { formatDate } from "@/lib/utils";

export function InlineLastContactDate({
  value,
  disabled,
  onChange,
}: {
  value: string | null;
  disabled?: boolean;
  onChange: (date: string | null) => void;
}) {
  return (
    <label
      className={`relative inline-flex max-w-full items-center gap-1 rounded px-1 py-0.5 text-xs underline decoration-dotted underline-offset-2 ${
        disabled
          ? "cursor-wait text-muted"
          : "cursor-pointer text-muted hover:bg-background hover:text-foreground"
      }`}
      title="Change last contact date"
    >
      <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">
        {disabled ? "Saving…" : formatDate(value)}
      </span>
      <input
        type="date"
        aria-label="Change last contact date"
        value={value?.slice(0, 10) ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value || null)}
        className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-wait"
      />
    </label>
  );
}
