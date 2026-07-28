"use client";

import { X } from "lucide-react";
import type { PlatformProductCatalogItem } from "@/lib/catalog/types";
import { addOnDefaultBillingType } from "@/lib/catalog/plan-inclusions";
import { formatMoney } from "@/lib/utils";
import type {
  CustomServiceAddOnRow,
  ServiceAddOnSelection,
} from "@/components/invite-client-service-add-ons-select";

function dollarsToCents(value: string): number {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

export function InviteClientSelectedAddOnsSummary({
  catalog,
  selections,
  onChange,
  customRows,
  onCustomRowsChange,
  onRemoveCatalog,
  onRemoveCustom,
}: {
  catalog: PlatformProductCatalogItem[];
  selections: ServiceAddOnSelection[];
  onChange: (next: ServiceAddOnSelection[]) => void;
  customRows: CustomServiceAddOnRow[];
  onCustomRowsChange: (rows: CustomServiceAddOnRow[]) => void;
  onRemoveCatalog: (productKey: string) => void;
  onRemoveCustom: (id: string) => void;
}) {
  const monthly = selections.filter(
    (s) => (s.billingType ?? addOnDefaultBillingType(s.productKey)) === "recurring",
  );
  const oneTime = [
    ...selections.filter(
      (s) => (s.billingType ?? addOnDefaultBillingType(s.productKey)) === "one_time",
    ),
    ...customRows.filter((row) => row.name.trim() && row.billingType === "one_time"),
  ];

  const monthlyCustom = customRows.filter(
    (row) => row.name.trim() && row.billingType !== "one_time",
  );

  const monthlyTotal =
    monthly.reduce((sum, s) => sum + dollarsToCents(s.monthlyPriceDollars), 0) +
    monthlyCustom.reduce((sum, row) => sum + dollarsToCents(row.monthlyPriceDollars), 0);

  const oneTimeTotal =
    selections
      .filter((s) => (s.billingType ?? addOnDefaultBillingType(s.productKey)) === "one_time")
      .reduce((sum, s) => sum + dollarsToCents(s.monthlyPriceDollars), 0) +
    customRows
      .filter((row) => row.billingType === "one_time" && row.name.trim())
      .reduce((sum, row) => sum + dollarsToCents(row.monthlyPriceDollars), 0);

  const hasAny =
    monthly.length > 0 ||
    oneTime.length > 0 ||
    monthlyCustom.length > 0 ||
    customRows.some((r) => r.billingType === "one_time" && r.name.trim());

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

  function updateCustom(id: string, patch: Partial<CustomServiceAddOnRow>) {
    onCustomRowsChange(
      customRows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h3 className="text-sm font-medium">Selected add-ons</h3>
      {!hasAny ? (
        <p className="mt-2 text-sm text-muted">No paid add-ons selected yet.</p>
      ) : (
        <div className="mt-3 space-y-4 text-sm">
          <SummaryGroup title="Monthly add-ons">
            {monthly.length === 0 && monthlyCustom.length === 0 ? (
              <p className="text-muted">None</p>
            ) : (
              <ul className="space-y-2">
                {monthly.map((selection) => {
                  const product = catalog.find(
                    (p) => p.product_key === selection.productKey,
                  );
                  return (
                    <SummaryRow
                      key={selection.productKey}
                      name={product?.name ?? selection.productKey}
                      price={selection.monthlyPriceDollars}
                      onPriceChange={(value) =>
                        updateSelection(selection.productKey, {
                          monthlyPriceDollars: value,
                        })
                      }
                      onRemove={() => onRemoveCatalog(selection.productKey)}
                    />
                  );
                })}
                {monthlyCustom.map((row) => (
                  <SummaryRow
                    key={row.id}
                    name={row.name || "Custom service"}
                    price={row.monthlyPriceDollars}
                    onPriceChange={(value) =>
                      updateCustom(row.id, { monthlyPriceDollars: value })
                    }
                    onRemove={() => onRemoveCustom(row.id)}
                  />
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted">
              Monthly add-ons total:{" "}
              <span className="font-medium text-foreground">
                {formatMoney(monthlyTotal)}/mo
              </span>
            </p>
          </SummaryGroup>

          <SummaryGroup title="One-time services">
            {oneTime.length === 0 &&
            !customRows.some((r) => r.billingType === "one_time" && r.name.trim()) ? (
              <p className="text-muted">None</p>
            ) : (
              <ul className="space-y-2">
                {selections
                  .filter(
                    (s) =>
                      (s.billingType ?? addOnDefaultBillingType(s.productKey)) ===
                      "one_time",
                  )
                  .map((selection) => {
                    const product = catalog.find(
                      (p) => p.product_key === selection.productKey,
                    );
                    return (
                      <SummaryRow
                        key={selection.productKey}
                        name={product?.name ?? selection.productKey}
                        price={selection.monthlyPriceDollars}
                        onPriceChange={(value) =>
                          updateSelection(selection.productKey, {
                            monthlyPriceDollars: value,
                          })
                        }
                        onRemove={() => onRemoveCatalog(selection.productKey)}
                      />
                    );
                  })}
                {customRows
                  .filter((row) => row.billingType === "one_time" && row.name.trim())
                  .map((row) => (
                    <SummaryRow
                      key={row.id}
                      name={row.name}
                      price={row.monthlyPriceDollars}
                      onPriceChange={(value) =>
                        updateCustom(row.id, { monthlyPriceDollars: value })
                      }
                      onRemove={() => onRemoveCustom(row.id)}
                    />
                  ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted">
              One-time charges total:{" "}
              <span className="font-medium text-foreground">
                {formatMoney(oneTimeTotal)}
              </span>
            </p>
          </SummaryGroup>
        </div>
      )}
    </div>
  );
}

function SummaryGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function SummaryRow({
  name,
  price,
  onPriceChange,
  onRemove,
}: {
  name: string;
  price: string;
  onPriceChange: (value: string) => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={price}
        onChange={(e) => onPriceChange(e.target.value)}
        className="w-24 rounded-md border border-border bg-background px-2 py-1 text-right text-xs"
        aria-label={`Price for ${name}`}
      />
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted hover:text-danger"
        aria-label={`Remove ${name}`}
      >
        <X className="size-4" aria-hidden />
      </button>
    </li>
  );
}
