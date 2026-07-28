"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  SERVICE_ADD_ON_SECTIONS,
  defaultAddOnPriceDollars,
  groupCatalogBySection,
} from "@/lib/catalog/catalog-sections";
import {
  addOnDefaultBillingType,
  paidAddOnCatalogItems,
} from "@/lib/catalog/plan-inclusions";
import type { PlatformProductCatalogItem } from "@/lib/catalog/types";
import { InviteClientSelectedAddOnsSummary } from "@/components/invite-client-selected-add-ons-summary";
import { cn } from "@/lib/utils";

export type ServiceAddOnSelection = {
  productKey: string;
  monthlyPriceDollars: string;
  quantity?: string;
  billingType?: "recurring" | "one_time";
};

export type CustomServiceAddOnRow = {
  id: string;
  name: string;
  description: string;
  monthlyPriceDollars: string;
  billingType: "recurring" | "one_time";
};

function newCustomRow(
  billingType: "recurring" | "one_time" = "recurring",
): CustomServiceAddOnRow {
  return {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    monthlyPriceDollars: "0",
    billingType,
  };
}

function formatDefaultPrice(
  product: PlatformProductCatalogItem,
  billingType: "recurring" | "one_time",
): string {
  const cents =
    product.default_add_on_price_cents ??
    product.suggested_add_on_price_cents ??
    0;
  if (cents === 0) return "Included";
  const amount = `$${(cents / 100).toFixed(0)}`;
  return billingType === "one_time" ? `${amount} one-time` : `${amount}/mo`;
}

export function InviteClientServiceAddOnsSelect({
  catalog,
  selections,
  onChange,
  customRows,
  onCustomRowsChange,
}: {
  catalog: PlatformProductCatalogItem[];
  selections: ServiceAddOnSelection[];
  onChange: (next: ServiceAddOnSelection[]) => void;
  customRows: CustomServiceAddOnRow[];
  onCustomRowsChange: (rows: CustomServiceAddOnRow[]) => void;
  /** @deprecated no longer used — custom rows are added on demand */
  otherSelected?: boolean;
  /** @deprecated */
  onOtherSelectedChange?: (selected: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const addOns = useMemo(() => paidAddOnCatalogItems(catalog), [catalog]);

  const sections = useMemo(
    () => groupCatalogBySection(addOns, SERVICE_ADD_ON_SECTIONS),
    [addOns],
  );

  const selectedKeys = useMemo(
    () => new Set(selections.map((s) => s.productKey)),
    [selections],
  );

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      for (const section of sections) {
        const count = section.items.filter((item) =>
          selectedKeys.has(item.product_key),
        ).length;
        if (count > 0) {
          next[section.key] = true;
        }
      }
      return next;
    });
  }, [sections, selectedKeys]);

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          `${item.name} ${item.category_group ?? ""}`.toLowerCase().includes(q),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, query]);

  if (addOns.length === 0) {
    return null;
  }

  function toggle(product: PlatformProductCatalogItem) {
    const billingType = addOnDefaultBillingType(product.product_key);
    const existing = selections.find(
      (item) => item.productKey === product.product_key,
    );
    if (existing) {
      onChange(
        selections.filter((item) => item.productKey !== product.product_key),
      );
      return;
    }

    onChange([
      ...selections,
      {
        productKey: product.product_key,
        monthlyPriceDollars: defaultAddOnPriceDollars(product),
        quantity: product.supports_quantity ? "1" : undefined,
        billingType,
      },
    ]);
  }

  function removeCatalog(productKey: string) {
    onChange(selections.filter((item) => item.productKey !== productKey));
  }

  function removeCustom(id: string) {
    onCustomRowsChange(customRows.filter((row) => row.id !== id));
  }

  function addCustomRow(billingType: "recurring" | "one_time") {
    onCustomRowsChange([...customRows, newCustomRow(billingType)]);
  }

  return (
    <section className="space-y-4">
      <header>
        <h3 className="text-sm font-medium">Paid add-ons</h3>
        <p className="mt-1 text-sm text-muted">
          Optional services billed on top of the plan. Adjust pricing per client
          in the summary.
        </p>
      </header>

      <InviteClientSelectedAddOnsSummary
        catalog={addOns}
        selections={selections}
        onChange={onChange}
        customRows={customRows}
        onCustomRowsChange={onCustomRowsChange}
        onRemoveCatalog={removeCatalog}
        onRemoveCustom={removeCustom}
      />

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search add-ons…"
        className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm"
      />

      <div className="space-y-2">
        {filteredSections.map((section) => {
          const selectedCount = section.items.filter((item) =>
            selectedKeys.has(item.product_key),
          ).length;
          const isOpen = expanded[section.key] ?? false;
          const panelId = `addon-section-${section.key}`;

          return (
            <div
              key={section.key}
              className="overflow-hidden rounded-lg border border-border"
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-background/60"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() =>
                  setExpanded((prev) => ({
                    ...prev,
                    [section.key]: !isOpen,
                  }))
                }
              >
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted transition-transform",
                    isOpen ? "rotate-0" : "-rotate-90",
                  )}
                  aria-hidden
                />
                <span className="flex-1 font-medium">{section.label}</span>
                {selectedCount > 0 ? (
                  <span className="rounded-full bg-foreground px-2 py-0.5 text-xs text-background">
                    {selectedCount}
                  </span>
                ) : null}
              </button>

              {isOpen ? (
                <div
                  id={panelId}
                  className="border-t border-border px-3 py-2"
                >
                  <div className="grid gap-2 sm:grid-cols-2">
                    {section.items.map((product) => {
                      const selected = selections.find(
                        (item) => item.productKey === product.product_key,
                      );
                      const billingType = addOnDefaultBillingType(
                        product.product_key,
                      );

                      return (
                        <label
                          key={product.id}
                          className={cn(
                            "flex cursor-pointer gap-2 rounded-md border px-2 py-2 text-sm transition-colors",
                            selected
                              ? "border-foreground bg-background"
                              : "border-transparent hover:bg-background/60",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={Boolean(selected)}
                            onChange={() => toggle(product)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="font-medium">{product.name}</span>
                              <BillingBadge billingType={billingType} />
                            </span>
                            <span className="text-xs text-muted">
                              {formatDefaultPrice(product, billingType)}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {section.key === "one_time" ? (
                    <CustomAddButton
                      onClick={() => addCustomRow("one_time")}
                    />
                  ) : null}
                  {section.key === "custom" ? (
                    <CustomAddButton
                      onClick={() => addCustomRow("recurring")}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {customRows.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Custom services (draft)
          </p>
          {customRows.map((row) => (
            <CustomRowEditor
              key={row.id}
              row={row}
              onChange={(patch) =>
                onCustomRowsChange(
                  customRows.map((r) =>
                    r.id === row.id ? { ...r, ...patch } : r,
                  ),
                )
              }
              onRemove={() => removeCustom(row.id)}
            />
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => addCustomRow("recurring")}
          className="text-sm font-medium text-muted underline-offset-2 hover:underline"
        >
          + Add custom service
        </button>
      </div>
    </section>
  );
}

function BillingBadge({
  billingType,
}: {
  billingType: "recurring" | "one_time";
}) {
  return (
    <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
      {billingType === "one_time" ? "One-time" : "Monthly"}
    </span>
  );
}

function CustomAddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 text-sm font-medium text-muted underline-offset-2 hover:underline"
    >
      + Add custom service
    </button>
  );
}

function CustomRowEditor({
  row,
  onChange,
  onRemove,
}: {
  row: CustomServiceAddOnRow;
  onChange: (patch: Partial<CustomServiceAddOnRow>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid gap-2 rounded-md border border-border/60 p-2 sm:grid-cols-2">
      <input
        value={row.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="Service name"
        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm sm:col-span-2"
      />
      <input
        value={row.description}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="Description (optional)"
        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm sm:col-span-2"
      />
      <select
        value={row.billingType}
        onChange={(e) =>
          onChange({
            billingType: e.target.value as CustomServiceAddOnRow["billingType"],
          })
        }
        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
      >
        <option value="recurring">Monthly</option>
        <option value="one_time">One-time</option>
      </select>
      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          step="0.01"
          value={row.monthlyPriceDollars}
          onChange={(e) => onChange({ monthlyPriceDollars: e.target.value })}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          aria-label="Price"
        />
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-muted hover:text-danger"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
