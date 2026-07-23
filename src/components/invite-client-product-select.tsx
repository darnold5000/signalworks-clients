"use client";

import { useMemo, useState } from "react";
import type { PlatformProductCatalogItem } from "@/lib/catalog/types";

export function InviteClientProductSelect({
  products,
  selectedKeys,
  onChange,
}: {
  products: PlatformProductCatalogItem[];
  selectedKeys: string[];
  onChange: (keys: string[]) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((product) => {
      const haystack = `${product.name} ${product.category ?? ""} ${product.product_key}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [products, query]);

  function toggle(productKey: string) {
    if (selectedKeys.includes(productKey)) {
      onChange(selectedKeys.filter((key) => key !== productKey));
      return;
    }
    onChange([...selectedKeys, productKey]);
  }

  return (
    <section className="space-y-4">
      <header>
        <h3 className="text-sm font-medium">Products &amp; Services</h3>
        <p className="mt-1 text-sm text-muted">
          Select products included with this plan at no additional charge.
        </p>
      </header>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products…"
        className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm"
      />

      <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
        {filtered.map((product) => {
          const checked = selectedKeys.includes(product.product_key);
          return (
            <label
              key={product.id}
              className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 hover:bg-background/60"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(product.product_key)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium">{product.name}</span>
                {product.category ? (
                  <span className="text-xs text-muted">{product.category}</span>
                ) : null}
              </span>
            </label>
          );
        })}
        {filtered.length === 0 ? (
          <p className="text-sm text-muted">No products match your search.</p>
        ) : null}
      </div>
    </section>
  );
}
