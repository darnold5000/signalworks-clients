"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type PipelineToastMessage = {
  id: number;
  text: string;
  tone: "success" | "error";
};

let toastId = 0;
const listeners = new Set<(message: PipelineToastMessage) => void>();

export function showPipelineToast(
  text: string,
  tone: "success" | "error" = "success",
) {
  const message: PipelineToastMessage = { id: ++toastId, text, tone };
  listeners.forEach((listener) => listener(message));
}

export function PipelineToastHost() {
  const [toast, setToast] = useState<PipelineToastMessage | null>(null);

  useEffect(() => {
    function onToast(message: PipelineToastMessage) {
      setToast(message);
    }

    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  return (
    <div
      role="status"
      className={cn(
        "fixed right-4 bottom-4 z-[100] max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg",
        toast.tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-success"
          : "border-red-200 bg-red-50 text-danger",
      )}
    >
      {toast.text}
    </div>
  );
}
