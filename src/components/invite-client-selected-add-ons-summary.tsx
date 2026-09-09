"use client";

import { X } from "lucide-react";
import type { PlatformProductCatalogItem } from "@/lib/catalog/types";
import { addOnDefaultBillingType } from "@/lib/catalog/plan-inclusions";
import { formatMoney } from "@/lib/utils";
import type {
  CustomServiceAddOnRow,
  ServiceAddOnSelection,
  ServicePricingMode,
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
  const selectionMode = (selection: ServiceAddOnSelection): ServicePricingMode =>
    selection.pricingMode ??
    ((selection.billingType ?? addOnDefaultBillingType(selection.productKey)) ===
    "one_time"
      ? "one_time"
      : "monthly");
  const byMode = (mode: ServicePricingMode) =>
    selections.filter((selection) => selectionMode(selection) === mode);
  const customByMode = (mode: ServicePricingMode) =>
    customRows.filter((row) => row.name.trim() && row.pricingMode === mode);
  const monthly = byMode("monthly");
  const annual = byMode("annual");
  const oneTime = byMode("one_time");
  const included = byMode("included");
  const monthlyCustom = customByMode("monthly");
  const annualCustom = customByMode("annual");
  const oneTimeCustom = customByMode("one_time");
  const includedCustom = customByMode("included");

  const monthlyTotal =
    monthly.reduce((sum, s) => sum + dollarsToCents(s.monthlyPriceDollars), 0) +
    monthlyCustom.reduce((sum, row) => sum + dollarsToCents(row.monthlyPriceDollars), 0);

  const oneTimeTotal =
    oneTime.reduce((sum, s) => sum + dollarsToCents(s.monthlyPriceDollars), 0) +
    oneTimeCustom
      .reduce((sum, row) => sum + dollarsToCents(row.monthlyPriceDollars), 0);
  const annualTotal =
    annual.reduce((sum, s) => sum + dollarsToCents(s.monthlyPriceDollars), 0) +
    annualCustom.reduce((sum, row) => sum + dollarsToCents(row.monthlyPriceDollars), 0);

  const hasAny =
    monthly.length > 0 ||
    annual.length > 0 ||
    oneTime.length > 0 ||
    included.length > 0 ||
    monthlyCustom.length > 0 ||
    annualCustom.length > 0 ||
    oneTimeCustom.length > 0 ||
    includedCustom.length > 0;

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
                      mode={selectionMode(selection)}
                      onModeChange={(pricingMode) =>
                        updateSelection(selection.productKey, { pricingMode })
                      }
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
                    mode={row.pricingMode}
                    onModeChange={(pricingMode) => updateCustom(row.id, { pricingMode })}
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

          <SummaryGroup title="Annual add-ons">
            {annual.length === 0 && annualCustom.length === 0 ? (
              <p className="text-muted">None</p>
            ) : (
              <ul className="space-y-2">
                {annual.map((selection) => {
                  const product = catalog.find((p) => p.product_key === selection.productKey);
                  return (
                    <SummaryRow
                      key={selection.productKey}
                      name={product?.name ?? selection.productKey}
                      price={selection.monthlyPriceDollars}
                      mode="annual"
                      onModeChange={(pricingMode) => updateSelection(selection.productKey, { pricingMode })}
                      onPriceChange={(value) => updateSelection(selection.productKey, { monthlyPriceDollars: value })}
                      onRemove={() => onRemoveCatalog(selection.productKey)}
                    />
                  );
                })}
                {annualCustom.map((row) => (
                  <SummaryRow
                    key={row.id}
                    name={row.name}
                    price={row.monthlyPriceDollars}
                    mode="annual"
                    onModeChange={(pricingMode) => updateCustom(row.id, { pricingMode })}
                    onPriceChange={(value) => updateCustom(row.id, { monthlyPriceDollars: value })}
                    onRemove={() => onRemoveCustom(row.id)}
                  />
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted">
              Annual add-ons total: <span className="font-medium text-foreground">{formatMoney(annualTotal)}/year</span>
            </p>
          </SummaryGroup>

          <SummaryGroup title="One-time services">
            {oneTime.length === 0 && oneTimeCustom.length === 0 ? (
              <p className="text-muted">None</p>
            ) : (
              <ul className="space-y-2">
                {oneTime.map((selection) => {
                    const product = catalog.find(
                      (p) => p.product_key === selection.productKey,
                    );
                    return (
                      <SummaryRow
                        key={selection.productKey}
                        name={product?.name ?? selection.productKey}
                        price={selection.monthlyPriceDollars}
                        mode="one_time"
                        onModeChange={(pricingMode) => updateSelection(selection.productKey, { pricingMode })}
                        onPriceChange={(value) =>
                          updateSelection(selection.productKey, {
                            monthlyPriceDollars: value,
                          })
                        }
                        onRemove={() => onRemoveCatalog(selection.productKey)}
                      />
                    );
                  })}
                {oneTimeCustom.map((row) => (
                    <SummaryRow
                      key={row.id}
                      name={row.name}
                      price={row.monthlyPriceDollars}
                      mode="one_time"
                      onModeChange={(pricingMode) => updateCustom(row.id, { pricingMode })}
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

          {(included.length > 0 || includedCustom.length > 0) ? (
            <SummaryGroup title="Included services">
              <ul className="space-y-2">
                {included.map((selection) => {
                  const product = catalog.find((p) => p.product_key === selection.productKey);
                  return <SummaryRow key={selection.productKey} name={product?.name ?? selection.productKey} price="0" mode="included" onModeChange={(pricingMode) => updateSelection(selection.productKey, { pricingMode })} onPriceChange={() => {}} onRemove={() => onRemoveCatalog(selection.productKey)} />;
                })}
                {includedCustom.map((row) => <SummaryRow key={row.id} name={row.name} price="0" mode="included" onModeChange={(pricingMode) => updateCustom(row.id, { pricingMode })} onPriceChange={() => {}} onRemove={() => onRemoveCustom(row.id)} />)}
              </ul>
            </SummaryGroup>
          ) : null}
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
  mode,
  onModeChange,
  onPriceChange,
  onRemove,
}: {
  name: string;
  price: string;
  mode: ServicePricingMode;
  onModeChange: (mode: ServicePricingMode) => void;
  onPriceChange: (value: string) => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
      <select
        aria-label={`Billing cadence for ${name}`}
        value={mode}
        onChange={(event) => onModeChange(event.target.value as ServicePricingMode)}
        className="rounded-md border border-border bg-background px-2 py-1 text-xs"
      >
        <option value="included">Included</option>
        <option value="one_time">One-time</option>
        <option value="monthly">Monthly</option>
        <option value="annual">Annually</option>
      </select>
      <input
        type="number"
        min="0"
        step="0.01"
        value={mode === "included" ? "0" : price}
        disabled={mode === "included"}
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
