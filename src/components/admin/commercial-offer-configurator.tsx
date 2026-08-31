"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  InviteCommercialExtras,
  InvitePlanSelection,
  InviteProductSelection,
} from "@/lib/catalog/build-invite-offer";
import { dollarsToCents } from "@/lib/catalog/build-invite-offer";
import type { CommercialOfferConfig } from "@/lib/catalog/commercial-config-validation";
import {
  addOnDefaultBillingType,
  DEFAULT_PLAN_INCLUSIONS,
  DEFAULT_SETUP_INCLUSIONS,
} from "@/lib/catalog/plan-inclusions";
import type {
  PlatformPlanTemplate,
  PlatformProductCatalogItem,
} from "@/lib/catalog/types";
import { InviteClientFinancialSummary } from "@/components/invite-client-financial-summary";
import { InviteClientPlanSelect } from "@/components/invite-client-plan-select";
import { InviteClientPlanInclusions } from "@/components/invite-client-plan-inclusions";
import {
  InviteClientPlatformComponentsSelect,
  type CustomPlatformComponentRow,
} from "@/components/invite-client-platform-components-select";
import {
  InviteClientServiceAddOnsSelect,
  type CustomServiceAddOnRow,
  type ServiceAddOnSelection,
} from "@/components/invite-client-service-add-ons-select";
import { Button } from "@/components/ui";

function configToState(
  config: CommercialOfferConfig | null,
  plans: PlatformPlanTemplate[],
): {
  selectedPlan: PlatformPlanTemplate | null;
  monthlyPriceDollars: string;
  selectedProductKeys: string[];
  customPlatformRows: CustomPlatformComponentRow[];
  serviceAddOnSelections: ServiceAddOnSelection[];
  customServiceAddOnRows: CustomServiceAddOnRow[];
  planInclusions: string[];
  setupInclusions: string[];
  setupFeeDollars: string;
  monthlyDiscountDollars: string;
  monthlyDiscountDurationMonths: string;
} {
  const fallbackPlan =
    plans.find((plan) => plan.plan_key === "launch") ?? plans[0] ?? null;
  const selectedPlan =
    plans.find((plan) => plan.plan_key === config?.planKey) ?? fallbackPlan;

  return {
    selectedPlan,
    monthlyPriceDollars: config
      ? String(config.monthlyPriceDollars)
      : selectedPlan
        ? String(selectedPlan.default_price_cents / 100)
        : "",
    selectedProductKeys: config?.productKeys ?? [],
    customPlatformRows: (config?.customPlatformComponents ?? []).map((row) => ({
      id: crypto.randomUUID(),
      name: row.name,
    })),
    serviceAddOnSelections: (config?.serviceAddOns ?? []).map((addOn) => ({
      productKey: addOn.productKey,
      monthlyPriceDollars: String(addOn.monthlyPriceDollars),
      quantity: addOn.quantity ? String(addOn.quantity) : undefined,
      billingType: addOn.billingType,
    })),
    customServiceAddOnRows: (config?.customServiceAddOns ?? []).map((row) => ({
      id: crypto.randomUUID(),
      name: row.name,
      description: row.description ?? "",
      monthlyPriceDollars: String(row.monthlyPriceDollars),
      billingType: row.billingType ?? "recurring",
    })),
    planInclusions: config?.planInclusions ?? [...DEFAULT_PLAN_INCLUSIONS],
    setupInclusions: config?.setupInclusions ?? [...DEFAULT_SETUP_INCLUSIONS],
    setupFeeDollars: config ? String(config.setupFeeDollars) : "0",
    monthlyDiscountDollars: config ? String(config.monthlyDiscountDollars) : "0",
    monthlyDiscountDurationMonths: config
      ? String(config.monthlyDiscountDurationMonths)
      : "0",
  };
}

export function buildCommercialOfferConfigFromState(args: {
  selectedPlan: PlatformPlanTemplate | null;
  monthlyPriceDollars: string;
  selectedProductKeys: string[];
  customPlatformRows: CustomPlatformComponentRow[];
  serviceAddOnSelections: ServiceAddOnSelection[];
  customServiceAddOnRows: CustomServiceAddOnRow[];
  planInclusions: string[];
  setupInclusions: string[];
  setupFeeDollars: string;
  monthlyDiscountDollars: string;
  monthlyDiscountDurationMonths: string;
  serviceAddOns: PlatformProductCatalogItem[];
}): CommercialOfferConfig {
  const parsedMonthly = Number.parseFloat(args.monthlyPriceDollars);
  if (!args.selectedPlan || Number.isNaN(parsedMonthly)) {
    throw new Error("Select a plan and monthly price.");
  }

  const paid_add_ons = args.serviceAddOnSelections
    .map((selection) => {
      const catalogItem = args.serviceAddOns.find(
        (product) => product.product_key === selection.productKey,
      );
      if (!catalogItem) return null;
      return {
        productKey: catalogItem.product_key,
        monthlyPriceDollars:
          Number.parseFloat(selection.monthlyPriceDollars) || 0,
        quantity: selection.quantity
          ? Number.parseInt(selection.quantity, 10) || 1
          : 1,
        billingType: selection.billingType,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    planKey: args.selectedPlan.plan_key as CommercialOfferConfig["planKey"],
    monthlyPriceDollars: parsedMonthly,
    productKeys: args.selectedProductKeys,
    serviceAddOns: paid_add_ons,
    customPlatformComponents: args.customPlatformRows
      .map((row) => ({ name: row.name.trim() }))
      .filter((row) => row.name.length > 0),
    customServiceAddOns: args.customServiceAddOnRows
      .map((row) => ({
        name: row.name.trim(),
        description: row.description.trim() || undefined,
        monthlyPriceDollars: Number.parseFloat(row.monthlyPriceDollars) || 0,
        billingType: row.billingType,
      }))
      .filter((row) => row.name.length > 0),
    setupFeeDollars: Number.parseFloat(args.setupFeeDollars) || 0,
    monthlyDiscountDollars: Number.parseFloat(args.monthlyDiscountDollars) || 0,
    monthlyDiscountDurationMonths:
      Number.parseInt(args.monthlyDiscountDurationMonths, 10) || 0,
    planInclusions: args.planInclusions,
    setupInclusions: args.setupInclusions,
  };
}

export function CommercialOfferConfigurator({
  plans,
  platformComponents,
  serviceAddOns,
  initialConfig,
  configVersion,
  disabled = false,
  busy = false,
  onApply,
}: {
  plans: PlatformPlanTemplate[];
  platformComponents: PlatformProductCatalogItem[];
  serviceAddOns: PlatformProductCatalogItem[];
  initialConfig: CommercialOfferConfig | null;
  configVersion: string;
  disabled?: boolean;
  busy?: boolean;
  onApply: (config: CommercialOfferConfig) => Promise<void>;
}) {
  const [state, setState] = useState(() => configToState(initialConfig, plans));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setState(configToState(initialConfig, plans));
    setError(null);
  }, [configVersion, initialConfig, plans]);

  const catalogComponentKeys = useMemo(
    () =>
      state.selectedProductKeys.filter(
        (key) => key !== "other" && key !== "other_add_on",
      ),
    [state.selectedProductKeys],
  );

  const selectedProducts = useMemo<InviteProductSelection[]>(() => {
    return platformComponents
      .filter((product) => catalogComponentKeys.includes(product.product_key))
      .map((product) => ({
        product_key: product.product_key,
        name: product.name,
      }));
  }, [platformComponents, catalogComponentKeys]);

  const selectedPlanSummary = useMemo<InvitePlanSelection | null>(() => {
    if (!state.selectedPlan) return null;
    const parsed = Number.parseFloat(state.monthlyPriceDollars);
    if (Number.isNaN(parsed)) return null;
    return {
      plan_key: state.selectedPlan.plan_key,
      name: state.selectedPlan.name,
      monthly_price_cents: Math.round(parsed * 100),
      billing_interval: state.selectedPlan
        .billing_interval as InvitePlanSelection["billing_interval"],
    };
  }, [state.selectedPlan, state.monthlyPriceDollars]);

  const inviteExtras = useMemo<InviteCommercialExtras>(() => {
    const setupFeeCents = dollarsToCents(
      Number.parseFloat(state.setupFeeDollars) || 0,
    );
    const monthlyDiscountCents = dollarsToCents(
      Number.parseFloat(state.monthlyDiscountDollars) || 0,
    );
    const durationMonths = Math.max(
      0,
      Number.parseInt(state.monthlyDiscountDurationMonths, 10) || 0,
    );

    const paid_add_ons = state.serviceAddOnSelections
      .map((selection) => {
        const catalogItem = serviceAddOns.find(
          (product) => product.product_key === selection.productKey,
        );
        if (!catalogItem) return null;
        const quantity = Math.max(
          1,
          Number.parseInt(selection.quantity ?? "1", 10) || 1,
        );
        return {
          product_key: catalogItem.product_key,
          name: catalogItem.name,
          unit_amount_cents: dollarsToCents(
            Number.parseFloat(selection.monthlyPriceDollars) || 0,
          ),
          quantity,
          billing_type:
            selection.billingType ??
            addOnDefaultBillingType(catalogItem.product_key),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const custom_platform_components = state.customPlatformRows
      .map((row) => ({ name: row.name.trim() }))
      .filter((row) => row.name.length > 0);

    const custom_service_add_ons = state.customServiceAddOnRows
      .map((row) => ({
        name: row.name.trim(),
        description: row.description.trim() || undefined,
        unit_amount_cents: dollarsToCents(
          Number.parseFloat(row.monthlyPriceDollars) || 0,
        ),
        billing_type: row.billingType,
      }))
      .filter((row) => row.name.length > 0);

    return {
      setup_fee_cents: setupFeeCents > 0 ? setupFeeCents : undefined,
      monthly_discount_cents:
        monthlyDiscountCents > 0 ? monthlyDiscountCents : undefined,
      monthly_discount_duration_months:
        monthlyDiscountCents > 0 && durationMonths > 0
          ? durationMonths
          : undefined,
      paid_add_ons: paid_add_ons.length > 0 ? paid_add_ons : undefined,
      custom_platform_components:
        custom_platform_components.length > 0
          ? custom_platform_components
          : undefined,
      custom_service_add_ons:
        custom_service_add_ons.length > 0 ? custom_service_add_ons : undefined,
    };
  }, [serviceAddOns, state]);

  if (plans.length === 0 || platformComponents.length === 0) {
    return (
      <p className="text-sm text-danger">
        Plan and product catalogs are not available. Apply platform catalog
        migrations and refresh this page.
      </p>
    );
  }

  async function handleApply() {
    setError(null);
    try {
      const config = buildCommercialOfferConfigFromState({
        ...state,
        serviceAddOns,
      });
      await onApply(config);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save commercial pricing.",
      );
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-8">
        <InviteClientPlanSelect
          plans={plans}
          selectedPlanKey={state.selectedPlan?.plan_key ?? null}
          monthlyPriceDollars={state.monthlyPriceDollars}
          onSelectPlan={(plan) =>
            setState((current) => ({
              ...current,
              selectedPlan: plan,
              monthlyPriceDollars: String(plan.default_price_cents / 100),
            }))
          }
          onMonthlyPriceChange={(value) =>
            setState((current) => ({ ...current, monthlyPriceDollars: value }))
          }
        />

        <InviteClientPlanInclusions
          planInclusions={state.planInclusions}
          setupInclusions={state.setupInclusions}
          onPlanInclusionsChange={(planInclusions) =>
            setState((current) => ({ ...current, planInclusions }))
          }
          onSetupInclusionsChange={(setupInclusions) =>
            setState((current) => ({ ...current, setupInclusions }))
          }
        />

        <InviteClientPlatformComponentsSelect
          components={platformComponents}
          selectedKeys={state.selectedProductKeys}
          onChange={(selectedProductKeys) =>
            setState((current) => ({ ...current, selectedProductKeys }))
          }
          customRows={state.customPlatformRows}
          onCustomRowsChange={(customPlatformRows) =>
            setState((current) => ({ ...current, customPlatformRows }))
          }
        />

        <InviteClientServiceAddOnsSelect
          catalog={serviceAddOns}
          selections={state.serviceAddOnSelections}
          onChange={(serviceAddOnSelections) =>
            setState((current) => ({ ...current, serviceAddOnSelections }))
          }
          customRows={state.customServiceAddOnRows}
          onCustomRowsChange={(customServiceAddOnRows) =>
            setState((current) => ({ ...current, customServiceAddOnRows }))
          }
        />

        <section className="space-y-4 rounded-xl border border-border bg-background/40 p-4">
          <header>
            <h3 className="text-sm font-medium">One-time &amp; discounts</h3>
            <p className="mt-1 text-sm text-muted">
              Setup fees are due upfront. Monthly discounts reduce recurring
              MRR.
            </p>
          </header>
          <label className="block max-w-xs space-y-1.5">
            <span className="text-sm font-medium">Setup fee (USD)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              disabled={disabled}
              value={state.setupFeeDollars}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  setupFeeDollars: event.target.value,
                }))
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm disabled:opacity-60"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Monthly discount (USD)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                disabled={disabled}
                value={state.monthlyDiscountDollars}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    monthlyDiscountDollars: event.target.value,
                  }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm disabled:opacity-60"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Duration (months)</span>
              <input
                type="number"
                min="0"
                max="120"
                step="1"
                disabled={disabled}
                value={state.monthlyDiscountDurationMonths}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    monthlyDiscountDurationMonths: event.target.value,
                  }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm disabled:opacity-60"
              />
            </label>
          </div>
          <p className="text-xs text-muted">
            Leave duration at 0 for a permanent discount. After the selected
            months, Stripe charges full recurring price.
          </p>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => void handleApply()}
            disabled={disabled || busy || !state.selectedPlan}
          >
            {busy ? "Saving pricing…" : "Save pricing"}
          </Button>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>
      </div>

      <InviteClientFinancialSummary
        plan={selectedPlanSummary}
        products={selectedProducts}
        extras={inviteExtras}
        className="xl:sticky xl:top-6 xl:self-start"
      />
    </div>
  );
}
