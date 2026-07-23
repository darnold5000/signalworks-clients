"use client";

import { useMemo, useState } from "react";
import type { PlatformProductCatalogItem } from "@/lib/catalog/types";

export type PaidAddOnSelection = {
  productKey: string;
  monthlyPriceDollars: string;
};

export function InviteClientPaidAddOnSelect({
  catalog,
  selections,
  onChange,
}: {
  catalog: PlatformProductCatalogItem[];
  selections: PaidAddOnSelection[];
  onChange: (next: PaidAddOnSelection[]) => void;
}) {
  const [query, setQuery] = useState("");

  const paidAddOns = useMemo(
    () => catalog.filter((item) => item.is_paid_add_on === true),
    [catalog],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return paidAddOns;
    return paidAddOns.filter((product) => {
      const haystack =
        `${product.name} ${product.category ?? ""} ${product.product_key}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [paidAddOns, query]);

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

    const defaultPrice =
      product.default_add_on_price_cents != null
        ? String(product.default_add_on_price_cents / 100)
        : "0";

    onChange([
      ...selections,
      { productKey: product.product_key, monthlyPriceDollars: defaultPrice },
    ]);
  }

  function updatePrice(productKey: string, monthlyPriceDollars: string) {
    onChange(
      selections.map((item) =>
        item.productKey === productKey ? { ...item, monthlyPriceDollars } : item,
      ),
    );
  }

  if (paidAddOns.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <header>
        <h3 className="text-sm font-medium">Paid add-ons</h3>
        <p className="mt-1 text-sm text-muted">
          Optional recurring add-ons billed separately from the base plan.
        </p>
      </header>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search add-ons…"
        className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm"
      />

      <div className="space-y-2 rounded-lg border border-border p-3">
        {filtered.map((product) => {
          const selected = selections.find(
            (item) => item.productKey === product.product_key,
          );
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
                  <span className="block text-sm font-medium">{product.name}</span>
                  {product.default_add_on_price_cents != null ? (
                    <span className="text-xs text-muted">
                      Default ${(product.default_add_on_price_cents / 100).toFixed(2)}
                      /mo
                    </span>
                  ) : null}
                </span>
              </label>
              {selected ? (
                <label className="mt-2 block pl-7">
                  <span className="text-xs text-muted">Monthly price (USD)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={selected.monthlyPriceDollars}
                    onChange={(e) =>
                      updatePrice(product.product_key, e.target.value)
                    }
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
              ) : null}
            </div>
          );
        })}
        {filtered.length === 0 ? (
          <p className="text-sm text-muted">No add-ons match your search.</p>
        ) : null}
      </div>
    </section>
  );
}
