"use client";

export function SowPrintActions() {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-end gap-4 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="text-sm font-medium underline underline-offset-2"
      >
        Print
      </button>
      <a
        href="/api/portal/legal/sow?download=1"
        className="text-sm font-medium underline underline-offset-2"
      >
        Download
      </a>
    </div>
  );
}
