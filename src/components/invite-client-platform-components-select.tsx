"use client";

import { useMemo, useState } from "react";
import {
  PLATFORM_COMPONENT_SECTIONS,
  groupCatalogBySection,
} from "@/lib/catalog/catalog-sections";
import type { PlatformProductCatalogItem } from "@/lib/catalog/types";

export type CustomPlatformComponentRow = {
  id: string;
  name: string;
};

function newRow(): CustomPlatformComponentRow {
  return { id: crypto.randomUUID(), name: "" };
}

export function InviteClientPlatformComponentsSelect({
  components,
  selectedKeys,
  onChange,
  customRows,
  onCustomRowsChange,
}: {
  components: PlatformProductCatalogItem[];
  selectedKeys: string[];
  onChange: (keys: string[]) => void;
  customRows: CustomPlatformComponentRow[];
  onCustomRowsChange: (rows: CustomPlatformComponentRow[]) => void;
}) {
  const sections = useMemo(
    () => groupCatalogBySection(components, PLATFORM_COMPONENT_SECTIONS),
    [components],
  );

  const otherSelected = selectedKeys.includes("other");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function toggle(productKey: string) {
    if (productKey === "other") {
      if (selectedKeys.includes("other")) {
        onChange(selectedKeys.filter((key) => key !== "other"));
        onCustomRowsChange([]);
        return;
      }
      onChange([...selectedKeys, "other"]);
      if (customRows.length === 0) {
        onCustomRowsChange([newRow()]);
      }
      return;
    }

    if (selectedKeys.includes(productKey)) {
      onChange(selectedKeys.filter((key) => key !== productKey));
      return;
    }
    onChange([...selectedKeys, productKey]);
  }

  function updateCustomRow(id: string, name: string) {
    onCustomRowsChange(
      customRows.map((row) => (row.id === id ? { ...row, name } : row)),
    );
  }

  function addCustomRow() {
    onCustomRowsChange([...customRows, newRow()]);
  }

  function removeCustomRow(id: string) {
    const next = customRows.filter((row) => row.id !== id);
    onCustomRowsChange(next.length > 0 ? next : [newRow()]);
  }

  return (
    <section className="space-y-6">
      <header>
        <h3 className="text-sm font-medium">Platform components</h3>
        <p className="mt-1 text-sm text-muted">
          What we are building — included with the plan at no extra charge.
        </p>
      </header>

      {sections.map((section) => (
        <CatalogSection key={section.key} label={section.label}>
          {section.items.map((item) => {
            const checked = selectedKeys.includes(item.product_key);
            const isOther = item.product_key === "other";
            const capabilities = item.capabilities ?? [];
            const showCapabilities = capabilities.length > 0 && !isOther;
            const isExpanded = expanded[item.product_key] ?? false;

            return (
              <div
                key={item.id}
                className="rounded-md px-2 py-2 hover:bg-background/60"
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(item.product_key)}
                    className="mt-1"
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{item.name}</span>
                    {item.description && !showCapabilities ? (
                      <span className="text-xs text-muted">{item.description}</span>
                    ) : null}
                  </span>
                </label>

                {showCapabilities && checked ? (
                  <div className="mt-2 pl-7">
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((prev) => ({
                          ...prev,
                          [item.product_key]: !prev[item.product_key],
                        }))
                      }
                      className="text-xs font-medium text-muted underline-offset-2 hover:underline"
                    >
                      {isExpanded
                        ? "Hide included capabilities"
                        : "Show included capabilities"}
                    </button>
                    {isExpanded ? (
                      <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-muted">
                        {capabilities.map((cap) => (
                          <li key={cap}>{cap}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}

                {isOther && otherSelected ? (
                  <div className="mt-3 space-y-3 pl-7">
                    {customRows.map((row, index) => (
                      <div key={row.id} className="flex gap-2">
                        <label className="block flex-1 space-y-1">
                          <span className="text-xs text-muted">
                            {index === 0 ? "Other service" : "Additional service"}
                          </span>
                          <input
                            value={row.name}
                            onChange={(e) => updateCustomRow(row.id, e.target.value)}
                            placeholder="Describe the component"
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                          />
                        </label>
                        {customRows.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeCustomRow(row.id)}
                            className="mt-5 text-xs text-muted hover:text-danger"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addCustomRow}
                      className="text-sm font-medium text-muted underline-offset-2 hover:underline"
                    >
                      + Add another
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </CatalogSection>
      ))}
    </section>
  );
}

function CatalogSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </h4>
      <div className="space-y-2 rounded-lg border border-border p-3">{children}</div>
    </div>
  );
}
