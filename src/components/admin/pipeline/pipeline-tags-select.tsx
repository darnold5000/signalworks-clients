"use client";

import { PIPELINE_TAGS, type PipelineTag } from "@/lib/pipeline/types";

export function PipelineTagsSelect({
  value,
  onChange,
}: {
  value: PipelineTag[];
  onChange: (tags: PipelineTag[]) => void;
}) {
  function toggle(tag: PipelineTag) {
    if (value.includes(tag)) {
      onChange(value.filter((item) => item !== tag));
      return;
    }
    onChange([...value, tag]);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {PIPELINE_TAGS.map((tag) => {
        const selected = value.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              selected
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}
