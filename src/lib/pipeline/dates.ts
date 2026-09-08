const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function parsePipelineDate(value: string): Date | null {
  const dateOnly = DATE_ONLY.exec(value);
  if (dateOnly) {
    return new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3]),
    );
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

/** Compact pipeline dates: "Today", "Yesterday", "Sep 11". */
export function formatPipelineDate(
  value: string | null | undefined,
  now = new Date(),
): string {
  if (!value) return "—";
  const date = parsePipelineDate(value);
  if (!date) return "—";

  const today = startOfLocalDay(now);
  const target = startOfLocalDay(date);
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / 86_400_000,
  );

  if (diffDays === 0) return "Today";
  if (diffDays === -1) return "Yesterday";
  if (diffDays === 1) return "Tomorrow";

  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  if (date.getFullYear() !== now.getFullYear()) {
    options.year = "numeric";
  }
  return new Intl.DateTimeFormat("en-US", options).format(date);
}
