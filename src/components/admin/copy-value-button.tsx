"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function CopyValueButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  if (!value) return null;

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className="h-7 px-2 py-0 text-xs"
      onClick={() => void onCopy()}
    >
      {copied ? "Copied" : `Copy ${label}`}
    </Button>
  );
}
