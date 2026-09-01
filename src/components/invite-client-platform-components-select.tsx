"use client";

import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import {
  PLATFORM_COMPONENT_SECTIONS,
  groupCatalogBySection,
} from "@/lib/catalog/catalog-sections";
import type { PlatformProductCatalogItem } from "@/lib/catalog/types";
import type { PlatformPricingMode } from "@/lib/offers/offer-item-metadata";
import { cn } from "@/lib/utils";

export type CustomPlatformComponentRow = {
  id: string;
  name: string;
  pricingMode: PlatformPricingMode;
  amountDollars: string;
};

export type PlatformComponentPricingState = {
  pricingMode: PlatformPricingMode;
  amountDollars: string;
};

function newRow(): CustomPlatformComponentRow {
  return {
    id: crypto.randomUUID(),
    name: "",
    pricingMode: "included",
    amountDollars: "0",
  };
}

const OPTIONAL_EXCLUDED_KEYS = new Set(["website"]);

export function InviteClientPlatformComponentsSelect({
  components,
  selectedKeys,
  onChange,
  customRows,
  onCustomRowsChange,
  pricingByKey = {},
  onPricingChange,
}: {
  components: PlatformProductCatalogItem[];
  selectedKeys: string[];
  onChange: (keys: string[]) => void;
  customRows: CustomPlatformComponentRow[];
  onCustomRowsChange: (rows: CustomPlatformComponentRow[]) => void;
  pricingByKey?: Record<string, PlatformComponentPricingState>;
  onPricingChange?: (
    productKey: string,
    pricing: PlatformComponentPricingState,
  ) => void;
}) {
  const [open, setOpen] = useState(
    () => selectedKeys.filter((k) => k !== "other").length > 0,
  );

  const optionalComponents = useMemo(
    () =>
      components.filter(
        (item) => !OPTIONAL_EXCLUDED_KEYS.has(item.product_key),
      ),
    [components],
  );

  const sections = useMemo(
    () => groupCatalogBySection(optionalComponents, PLATFORM_COMPONENT_SECTIONS),
    [optionalComponents],
  );

  const otherSelected = selectedKeys.includes("other");
  const selectedCount =
    selectedKeys.filter((key) => key !== "other").length +
    customRows.filter((row) => row.name.trim()).length;

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

  function updateCustomRow(
    id: string,
    patch: Partial<Omit<CustomPlatformComponentRow, "id">>,
  ) {
    onCustomRowsChange(
      customRows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function pricingControls(
    pricing: PlatformComponentPricingState,
    update: (next: PlatformComponentPricingState) => void,
    label: string,
  ) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
        <span className="text-xs font-medium text-muted">Pricing:</span>
        <select
          aria-label={`${label} pricing mode`}
          value={pricing.pricingMode}
          onChange={(event) =>
            update({
              ...pricing,
              pricingMode: event.target.value as PlatformPricingMode,
              amountDollars:
                event.target.value === "included" ? "0" : pricing.amountDollars,
            })
          }
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        >
          <option value="included">Included</option>
          <option value="one_time">One-time</option>
          <option value="monthly">Monthly</option>
        </select>
        {pricing.pricingMode !== "included" ? (
          <label className="flex items-center rounded-md border border-border bg-background px-2 text-sm">
            <span className="text-muted">$</span>
            <input
              aria-label={`${label} amount`}
              type="number"
              min="0"
              step="0.01"
              value={pricing.amountDollars}
              onChange={(event) =>
                update({ ...pricing, amountDollars: event.target.value })
              }
              className="w-24 bg-transparent px-1 py-1.5 outline-none"
            />
            <span className="text-xs text-muted">
              {pricing.pricingMode === "monthly" ? "/mo" : "one-time"}
            </span>
          </label>
        ) : null}
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-border">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-background/60"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted transition-transform",
            open ? "rotate-0" : "-rotate-90",
          )}
          aria-hidden
        />
        <span className="flex-1 font-medium">Additional platform scope (optional)</span>
        {selectedCount > 0 ? (
          <span className="rounded-full bg-foreground px-2 py-0.5 text-xs text-background">
            {selectedCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="space-y-4 border-t border-border p-3">
          <p className="text-sm text-muted">
            Standard plan inclusions are automatic. Select extra platform
            capabilities only when this client needs more than the base package.
          </p>

          {sections.map((section) => (
            <div key={section.key} className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                {section.label}
              </h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {section.items.map((item) => {
                  const checked = selectedKeys.includes(item.product_key);
                  const isOther = item.product_key === "other";
                  const pricing = pricingByKey[item.product_key] ?? {
                    pricingMode: "included" as const,
                    amountDollars: "0",
                  };

                  return (
                    <div key={item.id}>
                      <label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 text-sm hover:bg-background/60">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(item.product_key)}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="font-medium">{item.name}</span>
                          {item.description ? (
                            <span className="mt-0.5 block text-xs text-muted">
                              {item.description}
                            </span>
                          ) : null}
                        </span>
                      </label>

                      {checked && !isOther
                        ? pricingControls(pricing, (next) =>
                            onPricingChange?.(item.product_key, next),
                          item.name)
                        : null}

                      {isOther && otherSelected ? (
                        <div className="mt-2 space-y-2 pl-6">
                          {customRows.map((row) => (
                            <div key={row.id} className="rounded-md border border-border/70 p-2">
                              <input
                                value={row.name}
                                onChange={(e) =>
                                  updateCustomRow(row.id, { name: e.target.value })
                                }
                                placeholder="Custom component"
                                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                              />
                              {pricingControls(row, (next) =>
                                updateCustomRow(row.id, next),
                              row.name.trim() || "Custom component")}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() =>
                              onCustomRowsChange([...customRows, newRow()])
                            }
                            className="text-xs font-medium text-muted underline-offset-2 hover:underline"
                          >
                            + Add another
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
