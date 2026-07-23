"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  InviteCommercialExtras,
  InvitePlanSelection,
  InviteProductSelection,
} from "@/lib/catalog/build-invite-offer";
import { dollarsToCents } from "@/lib/catalog/build-invite-offer";
import type {
  PlatformPlanTemplate,
  PlatformProductCatalogItem,
} from "@/lib/catalog/types";
import { Button } from "@/components/ui";
import { InviteClientFinancialSummary } from "@/components/invite-client-financial-summary";
import { InviteClientPlanSelect } from "@/components/invite-client-plan-select";
import {
  InviteClientPlatformComponentsSelect,
  type CustomPlatformComponentRow,
} from "@/components/invite-client-platform-components-select";
import {
  InviteClientServiceAddOnsSelect,
  type CustomServiceAddOnRow,
  type ServiceAddOnSelection,
} from "@/components/invite-client-service-add-ons-select";

const inputClassName =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm";

export function InviteClientForm({
  plans,
  platformComponents,
  serviceAddOns,
}: {
  plans: PlatformPlanTemplate[];
  platformComponents: PlatformProductCatalogItem[];
  serviceAddOns: PlatformProductCatalogItem[];
}) {
  const router = useRouter();
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [domain, setDomain] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PlatformPlanTemplate | null>(
    plans.find((plan) => plan.plan_key === "launch") ?? plans[0] ?? null,
  );
  const [monthlyPriceDollars, setMonthlyPriceDollars] = useState(
    selectedPlan ? String(selectedPlan.default_price_cents / 100) : "",
  );
  const [selectedProductKeys, setSelectedProductKeys] = useState<string[]>([]);
  const [customPlatformRows, setCustomPlatformRows] = useState<
    CustomPlatformComponentRow[]
  >([]);
  const [serviceAddOnSelections, setServiceAddOnSelections] = useState<
    ServiceAddOnSelection[]
  >([]);
  const [customServiceAddOnRows, setCustomServiceAddOnRows] = useState<
    CustomServiceAddOnRow[]
  >([]);
  const [customAddOnsSelected, setCustomAddOnsSelected] = useState(false);
  const [setupFeeDollars, setSetupFeeDollars] = useState("0");
  const [monthlyDiscountDollars, setMonthlyDiscountDollars] = useState("0");
  const [monthlyDiscountDurationMonths, setMonthlyDiscountDurationMonths] =
    useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorTenantId, setErrorTenantId] = useState<string | null>(null);
  const [result, setResult] = useState<{
    message: string;
    inviteLink: string | null;
    redirectTo: string;
  } | null>(null);

  const catalogComponentKeys = useMemo(
    () =>
      selectedProductKeys.filter(
        (key) => key !== "other" && key !== "other_add_on",
      ),
    [selectedProductKeys],
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
    if (!selectedPlan) return null;
    const parsed = Number.parseFloat(monthlyPriceDollars);
    if (Number.isNaN(parsed)) return null;
    return {
      plan_key: selectedPlan.plan_key,
      name: selectedPlan.name,
      monthly_price_cents: Math.round(parsed * 100),
      billing_interval: selectedPlan.billing_interval as InvitePlanSelection["billing_interval"],
    };
  }, [selectedPlan, monthlyPriceDollars]);

  const inviteExtras = useMemo<InviteCommercialExtras>(() => {
    const setupFeeCents = dollarsToCents(
      Number.parseFloat(setupFeeDollars) || 0,
    );
    const monthlyDiscountCents = dollarsToCents(
      Number.parseFloat(monthlyDiscountDollars) || 0,
    );
    const durationMonths = Math.max(
      0,
      Number.parseInt(monthlyDiscountDurationMonths, 10) || 0,
    );

    const paid_add_ons = serviceAddOnSelections
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
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const custom_platform_components = customPlatformRows
      .map((row) => ({ name: row.name.trim() }))
      .filter((row) => row.name.length > 0);

    const custom_service_add_ons = customServiceAddOnRows
      .map((row) => ({
        name: row.name.trim(),
        description: row.description.trim() || undefined,
        unit_amount_cents: dollarsToCents(
          Number.parseFloat(row.monthlyPriceDollars) || 0,
        ),
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
  }, [
    customPlatformRows,
    customServiceAddOnRows,
    monthlyDiscountDollars,
    monthlyDiscountDurationMonths,
    serviceAddOnSelections,
    serviceAddOns,
    setupFeeDollars,
  ]);

  if (plans.length === 0) {
    return (
      <p className="text-sm text-danger">
        Plan catalog is not available. Apply migration
        {" "}
        <code className="text-xs">010_platform_catalogs.sql</code>
        {" "}
        and refresh this page.
      </p>
    );
  }

  function handleSelectPlan(plan: PlatformPlanTemplate) {
    setSelectedPlan(plan);
    setMonthlyPriceDollars(String(plan.default_price_cents / 100));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrorTenantId(null);
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/invite-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          contactName,
          email,
          phone,
          websiteUrl,
          domain,
          planKey: selectedPlan?.plan_key,
          monthlyPriceDollars: Number.parseFloat(monthlyPriceDollars),
          productKeys: selectedProductKeys,
          serviceAddOns: serviceAddOnSelections.map((selection) => ({
            productKey: selection.productKey,
            monthlyPriceDollars:
              Number.parseFloat(selection.monthlyPriceDollars) || 0,
            quantity: selection.quantity
              ? Number.parseInt(selection.quantity, 10) || 1
              : undefined,
          })),
          customPlatformComponents: customPlatformRows
            .map((row) => ({ name: row.name.trim() }))
            .filter((row) => row.name.length > 0),
          customServiceAddOns: customServiceAddOnRows
            .map((row) => ({
              name: row.name.trim(),
              description: row.description.trim() || undefined,
              monthlyPriceDollars:
                Number.parseFloat(row.monthlyPriceDollars) || 0,
            }))
            .filter((row) => row.name.length > 0),
          setupFeeDollars: Number.parseFloat(setupFeeDollars) || 0,
          monthlyDiscountDollars: Number.parseFloat(monthlyDiscountDollars) || 0,
          monthlyDiscountDurationMonths:
            Number.parseInt(monthlyDiscountDurationMonths, 10) || 0,
          idempotencyKey: idempotencyKeyRef.current,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const detail =
          data.details?.fieldErrors &&
          Object.entries(data.details.fieldErrors as Record<string, string[]>)
            .map(([field, messages]) =>
              messages?.length ? `${field}: ${messages[0]}` : null,
            )
            .filter(Boolean)
            .join(" · ");
        setError(detail || data.error || data.note || "Invite failed");
        setErrorTenantId(
          typeof data.tenantId === "string" ? data.tenantId : null,
        );
        return;
      }

      setResult({
        message: data.message,
        inviteLink: data.inviteLink,
        redirectTo: data.redirectTo,
      });

      if (data.redirectTo) {
        router.push(data.redirectTo);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  if (plans.length === 0 || platformComponents.length === 0) {
    return (
      <p className="text-sm text-danger">
        Plan and product catalogs are not available. Apply migrations
        {" "}
        <code className="text-xs">010_platform_catalogs.sql</code>
        {" "}
        and
        {" "}
        <code className="text-xs">015_catalog_v2_platform_components.sql</code>
        , then refresh.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <p className="text-sm text-muted">
        Create a new client tenant, commercial offer, and first-time portal
        invite. Platform components define what gets built; service add-ons define
        ongoing services.
      </p>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          <section className="space-y-4">
            <header>
              <h3 className="text-sm font-medium">Client</h3>
            </header>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Business name</span>
              <input
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className={inputClassName}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Contact name (optional)</span>
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className={inputClassName}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Client email</span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClassName}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Phone (optional)</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClassName}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Website URL (optional)</span>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://"
                  className={inputClassName}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Domain (optional)</span>
                <input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="example.com"
                  className={inputClassName}
                />
              </label>
            </div>
          </section>

          <InviteClientPlanSelect
            plans={plans}
            selectedPlanKey={selectedPlan?.plan_key ?? null}
            monthlyPriceDollars={monthlyPriceDollars}
            onSelectPlan={handleSelectPlan}
            onMonthlyPriceChange={setMonthlyPriceDollars}
          />

          <InviteClientPlatformComponentsSelect
            components={platformComponents}
            selectedKeys={selectedProductKeys}
            onChange={setSelectedProductKeys}
            customRows={customPlatformRows}
            onCustomRowsChange={setCustomPlatformRows}
          />

          <InviteClientServiceAddOnsSelect
            catalog={serviceAddOns}
            selections={serviceAddOnSelections}
            onChange={setServiceAddOnSelections}
            customRows={customServiceAddOnRows}
            onCustomRowsChange={setCustomServiceAddOnRows}
            otherSelected={customAddOnsSelected}
            onOtherSelectedChange={setCustomAddOnsSelected}
          />

          <section className="space-y-4">
            <header>
              <h3 className="text-sm font-medium">One-time &amp; discounts</h3>
              <p className="mt-1 text-sm text-muted">
                Setup fees are due upfront. Monthly discounts reduce recurring MRR.
              </p>
            </header>
            <label className="block max-w-xs space-y-1.5">
              <span className="text-sm font-medium">Setup fee (USD)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={setupFeeDollars}
                onChange={(e) => setSetupFeeDollars(e.target.value)}
                className={inputClassName}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Monthly discount (USD)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={monthlyDiscountDollars}
                  onChange={(e) => setMonthlyDiscountDollars(e.target.value)}
                  className={inputClassName}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Duration (months)</span>
                <input
                  type="number"
                  min="0"
                  max="120"
                  step="1"
                  value={monthlyDiscountDurationMonths}
                  onChange={(e) =>
                    setMonthlyDiscountDurationMonths(e.target.value)
                  }
                  className={inputClassName}
                />
              </label>
            </div>
            <p className="text-xs text-muted">
              Leave duration at 0 for a permanent discount. After the selected
              months, Stripe charges full recurring price.
            </p>
          </section>
        </div>

        <InviteClientFinancialSummary
          plan={selectedPlanSummary}
          products={selectedProducts}
          extras={inviteExtras}
        />
      </div>

      {error ? (
        <div className="space-y-2 text-sm text-danger">
          <p>{error}</p>
          {errorTenantId ? (
            <p>
              <Link
                href={`/admin/clients/${errorTenantId}/offers`}
                className="font-medium underline underline-offset-2"
              >
                Open existing client offers
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      {result ? (
        <div className="space-y-2 rounded-lg border border-border bg-background p-4 text-sm">
          <p className="text-success">{result.message}</p>
          {result.inviteLink ? (
            <textarea
              readOnly
              value={result.inviteLink}
              className="h-24 w-full rounded-md border border-border bg-surface p-2 text-xs"
            />
          ) : null}
        </div>
      ) : null}

      <Button type="submit" disabled={loading || !selectedPlan}>
        {loading ? "Creating client & invite…" : "Create client & send invite"}
      </Button>
    </form>
  );
}

