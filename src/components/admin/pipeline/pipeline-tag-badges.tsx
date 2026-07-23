"use client";

import type { PipelineTag } from "@/lib/pipeline/types";

export function PipelineTagBadges({
  tags,
  className,
}: {
  tags: PipelineTag[];
  className?: string;
}) {
  if (tags.length === 0) {
    return <span className="text-muted">—</span>;
  }

  return (
    <div className={`flex flex-wrap gap-1 ${className ?? ""}`}>
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
