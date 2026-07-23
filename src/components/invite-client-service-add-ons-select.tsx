"use client";

import { useMemo, useState } from "react";
import {
  SERVICE_ADD_ON_SECTIONS,
  defaultAddOnPriceDollars,
  groupCatalogBySection,
} from "@/lib/catalog/catalog-sections";
import type { PlatformProductCatalogItem } from "@/lib/catalog/types";

export type ServiceAddOnSelection = {
  productKey: string;
  monthlyPriceDollars: string;
  quantity?: string;
};

export type CustomServiceAddOnRow = {
  id: string;
  name: string;
  description: string;
  monthlyPriceDollars: string;
};

function newCustomRow(): CustomServiceAddOnRow {
  return {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    monthlyPriceDollars: "0",
  };
}

function formatCatalogPrice(cents: number | null | undefined): string {
  if (cents == null) return "";
  return `$${(cents / 100).toFixed(0)}/mo default`;
}

export function InviteClientServiceAddOnsSelect({
  catalog,
  selections,
  onChange,
  customRows,
  onCustomRowsChange,
  otherSelected,
  onOtherSelectedChange,
}: {
  catalog: PlatformProductCatalogItem[];
  selections: ServiceAddOnSelection[];
  onChange: (next: ServiceAddOnSelection[]) => void;
  customRows: CustomServiceAddOnRow[];
  onCustomRowsChange: (rows: CustomServiceAddOnRow[]) => void;
  otherSelected: boolean;
  onOtherSelectedChange: (selected: boolean) => void;
}) {
  const [query, setQuery] = useState("");

  const addOns = useMemo(
    () => catalog.filter((item) => item.product_key !== "other_add_on"),
    [catalog],
  );

  const sections = useMemo(
    () => groupCatalogBySection(addOns, SERVICE_ADD_ON_SECTIONS),
    [addOns],
  );

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

  function toggle(product: PlatformProductCatalogItem) {
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
      },
    ]);
  }

  function updateSelection(
    productKey: string,
    patch: Partial<ServiceAddOnSelection>,
  ) {
    onChange(
      selections.map((item) =>
        item.productKey === productKey ? { ...item, ...patch } : item,
      ),
    );
  }

  function toggleOther() {
    if (otherSelected) {
      onOtherSelectedChange(false);
      onCustomRowsChange([]);
      return;
    }
    onOtherSelectedChange(true);
    if (customRows.length === 0) {
      onCustomRowsChange([newCustomRow()]);
    }
  }

  function updateCustomRow(id: string, patch: Partial<CustomServiceAddOnRow>) {
    onCustomRowsChange(
      customRows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  if (addOns.length === 0) {
    return null;
  }

  return (
    <section className="space-y-6">
      <header>
        <h3 className="text-sm font-medium">Service add-ons</h3>
        <p className="mt-1 text-sm text-muted">
          Ongoing services billed separately. Default price is a starting point —
          adjust per client without changing the catalog.
        </p>
      </header>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search add-ons…"
        className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm"
      />

      {filteredSections.map((section) => (
        <div key={section.key} className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
            {section.label}
          </h4>
          <div className="space-y-2 rounded-lg border border-border p-3">
            {section.items.map((product) => {
              const selected = selections.find(
                (item) => item.productKey === product.product_key,
              );
              const defaultCents = product.default_add_on_price_cents;
              const suggestedCents = product.suggested_add_on_price_cents;

              return (
                <div
                  key={product.id}
                  className="rounded-md px-2 py-2 hover:bg-background/60"
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={Boolean(selected)}
                      onChange={() => toggle(product)}
                      className="mt-1"
                    />
                    <span className="flex-1">
                      <span className="block text-sm font-medium">
                        {product.name}
                      </span>
                      <span className="text-xs text-muted">
                        {formatCatalogPrice(defaultCents)}
                        {suggestedCents != null &&
                        suggestedCents !== defaultCents
                          ? ` · suggested $${(suggestedCents / 100).toFixed(0)}/mo`
                          : ""}
                      </span>
                    </span>
                  </label>

                  {selected ? (
                    <div className="mt-2 grid gap-3 pl-7 sm:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-xs text-muted">Price (USD/mo)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={selected.monthlyPriceDollars}
                          onChange={(e) =>
                            updateSelection(product.product_key, {
                              monthlyPriceDollars: e.target.value,
                            })
                          }
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        />
                      </label>
                      {product.supports_quantity ? (
                        <label className="block space-y-1">
                          <span className="text-xs text-muted">Quantity</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={selected.quantity ?? "1"}
                            onChange={(e) =>
                              updateSelection(product.product_key, {
                                quantity: e.target.value,
                              })
                            }
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                          />
                        </label>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Custom
        </h4>
        <div className="rounded-lg border border-border p-3">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={otherSelected}
              onChange={toggleOther}
              className="mt-1"
            />
            <span className="text-sm font-medium">Other</span>
          </label>

          {otherSelected ? (
            <div className="mt-3 space-y-4 pl-7">
              {customRows.map((row) => (
                <CustomAddOnRowEditor
                  key={row.id}
                  row={row}
                  onChange={(patch) => updateCustomRow(row.id, patch)}
                  onRemove={
                    customRows.length > 1
                      ? () =>
                          onCustomRowsChange(
                            customRows.filter((item) => item.id !== row.id),
                          )
                      : undefined
                  }
                />
              ))}
              <button
                type="button"
                onClick={() => onCustomRowsChange([...customRows, newCustomRow()])}
                className="text-sm font-medium text-muted underline-offset-2 hover:underline"
              >
                + Add another
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function CustomAddOnRowEditor({
  row,
  onChange,
  onRemove,
}: {
  row: CustomServiceAddOnRow;
  onChange: (patch: Partial<CustomServiceAddOnRow>) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="space-y-3 rounded-md border border-border/60 p-3">
      <div className="flex gap-2">
        <label className="block flex-1 space-y-1">
          <span className="text-xs text-muted">Name</span>
          <input
            value={row.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block w-32 space-y-1">
          <span className="text-xs text-muted">Price/mo</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={row.monthlyPriceDollars}
            onChange={(e) => onChange({ monthlyPriceDollars: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="mt-5 text-xs text-muted hover:text-danger"
          >
            Remove
          </button>
        ) : null}
      </div>
      <label className="block space-y-1">
        <span className="text-xs text-muted">Description (optional)</span>
        <input
          value={row.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
    </div>
  );
}
