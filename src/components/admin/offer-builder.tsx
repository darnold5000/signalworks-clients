"use client";

import { useMemo, useState } from "react";
import type {
  ClientOffer,
  ClientOfferFeature,
  ClientOfferItem,
  ClientOfferItemType,
  TenantContact,
  ProposalRecipient,
  ProposalBillingMethod,
} from "@/lib/database/phase1-types";
import type { CommercialOfferConfig } from "@/lib/catalog/commercial-config-validation";
import type {
  PlatformPlanTemplate,
  PlatformProductCatalogItem,
} from "@/lib/catalog/types";
import {
  offerBillingMethodLabel,
  resolveOfferBillingMethod,
} from "@/lib/offers/billing-method";
import { DISCOUNT_SCOPE } from "@/lib/offers/discount-scope";
import { defaultBillingForItemType } from "@/lib/offers/build-offer-item-payload";
import { partitionOfferItems } from "@/lib/offers/managed-commercial-items";
import { parseCommercialConfigFromOffer } from "@/lib/offers/parse-commercial-config-from-offer";
import { CommercialOfferConfigurator } from "@/components/admin/commercial-offer-configurator";
import { Button, Panel, StatusPill } from "@/components/ui";
import { SendProposalButton } from "@/components/admin/send-proposal-button";
import { formatMoney } from "@/lib/utils";
import { calculateAmountDueFirstCycle } from "@/lib/offers/calculate-totals";
import { formatOfferLineItemSubtitle } from "@/lib/offers/format-offer-line-item-meta";

type OfferWithItems = ClientOffer & {
  items: ClientOfferItem[];
  features: ClientOfferFeature[];
};

type ItemFormState = {
  itemType: ClientOfferItemType;
  name: string;
  description: string;
  quantity: number;
  unitAmountDollars: string;
  billingType: "one_time" | "recurring";
  billingInterval: "month" | "year";
  billingIntervalCount: number;
  discountType: "" | "amount" | "percent";
  discountAmountDollars: string;
  discountPercent: string;
  discountDurationType: "once" | "repeating" | "forever";
  discountDurationMonths: number;
  discountScope:
    | typeof DISCOUNT_SCOPE.RECURRING
    | typeof DISCOUNT_SCOPE.FIRST_CYCLE;
};

const EMPTY_ITEM: ItemFormState = {
  itemType: "custom_service",
  name: "",
  description: "",
  quantity: 1,
  unitAmountDollars: "",
  billingType: "one_time",
  billingInterval: "month",
  billingIntervalCount: 1,
  discountType: "",
  discountAmountDollars: "",
  discountPercent: "",
  discountDurationType: "repeating",
  discountDurationMonths: 6,
  discountScope: DISCOUNT_SCOPE.FIRST_CYCLE,
};

function dollarsToCents(value: string): number {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

function offerStatusLabel(status: ClientOffer["status"]): string {
  if (status === "published") return "Sent";
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ProposalSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-background/40 p-4 md:p-5">
      <header className="mb-4">
        <h3 className="text-sm font-semibold tracking-wide uppercase text-muted">
          {title}
        </h3>
        {description ? (
          <p className="mt-1 text-sm text-muted">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

const BILLING_OPTIONS = [
  {
    value: "stripe_checkout" as const,
    title: "Online Payment / Subscription",
    description:
      "Client accepts the proposal and continues to online payment or subscription setup.",
  },
  {
    value: "proposal_only" as const,
    title: "Proposal Only",
    description:
      "Client accepts the proposal. Billing will be configured separately.",
  },
];

export function OfferBuilder({
  tenantId,
  initialOffers,
  contacts,
  recipientDeliveries,
  plans,
  platformComponents,
  serviceAddOns,
}: {
  tenantId: string;
  initialOffers: OfferWithItems[];
  contacts: TenantContact[];
  recipientDeliveries: ProposalRecipient[];
  plans: PlatformPlanTemplate[];
  platformComponents: PlatformProductCatalogItem[];
  serviceAddOns: PlatformProductCatalogItem[];
}) {
  const [offers, setOffers] = useState(initialOffers);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialOffers[0]?.id ?? null,
  );
  const [title, setTitle] = useState("");
  const [shortSummary, setShortSummary] = useState("");
  const [description, setDescription] = useState("");
  const [billingMethod, setBillingMethod] =
    useState<ProposalBillingMethod>("stripe_checkout");
  const [newFeature, setNewFeature] = useState("");
  const [itemForm, setItemForm] = useState<ItemFormState>(EMPTY_ITEM);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showAdvancedItems, setShowAdvancedItems] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selected = useMemo(
    () => offers.find((offer) => offer.id === selectedId) ?? null,
    [offers, selectedId],
  );

  const itemPartitions = useMemo(
    () =>
      selected
        ? partitionOfferItems(selected.items)
        : { managed: [], manual: [] },
    [selected],
  );

  const commercialConfig = useMemo(
    () =>
      selected
        ? parseCommercialConfigFromOffer(selected, selected.items)
        : null,
    [selected],
  );

  const configVersion = selected
    ? `${selected.id}:${selected.updated_at}:${selected.items.map((item) => item.id).join(",")}`
    : "";

  async function refreshOffers(selectId?: string) {
    const res = await fetch(`/api/admin/clients/${tenantId}/offers`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not load proposals");
    setOffers(data.offers);
    if (selectId) setSelectedId(selectId);
    else if (!selectedId && data.offers[0]) setSelectedId(data.offers[0].id);
  }

  async function createOffer() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/clients/${tenantId}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Client proposal",
          shortSummary: shortSummary || undefined,
          description: description || undefined,
          billingMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create proposal");
      setTitle("");
      setShortSummary("");
      setDescription("");
      setBillingMethod("stripe_checkout");
      await refreshOffers(data.offer.id);
      setMessage("Draft proposal created. Continue editing below.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create proposal");
    } finally {
      setBusy(false);
    }
  }

  function updateSelected(patch: Partial<OfferWithItems>) {
    if (!selected) return;
    setOffers((current) =>
      current.map((offer) =>
        offer.id === selected.id ? { ...offer, ...patch } : offer,
      ),
    );
  }

  async function saveProposal(): Promise<boolean> {
    if (!selected || selected.status !== "draft") return false;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/clients/${tenantId}/offers/${selected.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: selected.title,
            shortSummary: selected.short_summary ?? "",
            description: selected.description ?? "",
            features: selected.features.map((feature) => feature.label),
            billingMethod: resolveOfferBillingMethod(selected),
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save proposal");
      await refreshOffers(selected.id);
      setMessage("Draft saved.");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save proposal");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function applyCommercialPricing(config: CommercialOfferConfig) {
    if (!selected || selected.status !== "draft") return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/clients/${tenantId}/offers/${selected.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applyCommercialConfig: config }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Could not save commercial pricing");
      }
      setOffers((current) =>
        current.map((offer) =>
          offer.id === selected.id ? data.offer : offer,
        ),
      );
      setMessage("Commercial pricing saved.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save commercial pricing",
      );
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function previewAsClient() {
    if (!selected || selected.status !== "draft") return;
    const previewWindow = window.open("about:blank", "_blank");
    if (previewWindow) previewWindow.opener = null;
    const saved = await saveProposal();
    if (!saved) {
      previewWindow?.close();
      return;
    }
    const previewUrl = `/proposal-preview/${tenantId}/${selected.id}`;
    if (previewWindow) previewWindow.location.href = previewUrl;
    else window.open(previewUrl, "_blank", "noopener,noreferrer");
  }

  async function deleteDraft() {
    if (!selected || selected.status !== "draft") return;
    const confirmed = window.confirm(
      "Delete proposal?\n\nThis will permanently delete this draft and its line items. No billing will be affected.",
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/clients/${tenantId}/offers/${selected.id}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not delete draft");

      const remainingOffers = offers.filter((offer) => offer.id !== selected.id);
      setOffers(remainingOffers);
      setSelectedId(remainingOffers[0]?.id ?? null);
      setMessage("Draft proposal deleted. No billing was affected.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete draft");
    } finally {
      setBusy(false);
    }
  }

  function addFeature() {
    if (!selected) return;
    const label = newFeature.trim();
    if (!label) return;
    const feature: ClientOfferFeature = {
      id: crypto.randomUUID(),
      offer_id: selected.id,
      tenant_id: tenantId,
      label,
      sort_order: selected.features.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    updateSelected({ features: [...selected.features, feature] });
    setNewFeature("");
  }

  function updateFeature(index: number, label: string) {
    if (!selected) return;
    updateSelected({
      features: selected.features.map((feature, featureIndex) =>
        featureIndex === index ? { ...feature, label } : feature,
      ),
    });
  }

  function removeFeature(index: number) {
    if (!selected) return;
    updateSelected({
      features: selected.features.filter((_, featureIndex) => featureIndex !== index),
    });
  }

  function moveFeature(index: number, direction: -1 | 1) {
    if (!selected) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= selected.features.length) return;
    const features = [...selected.features];
    [features[index], features[nextIndex]] = [features[nextIndex], features[index]];
    updateSelected({ features });
  }

  async function saveItem() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/clients/${tenantId}/offers/${selected.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            [editingItemId ? "updateItem" : "addItem"]: {
              ...(editingItemId ? { id: editingItemId } : {}),
              itemType: itemForm.itemType,
              name: itemForm.name,
              description: itemForm.description || undefined,
              quantity: itemForm.quantity,
              unitAmountCents: dollarsToCents(itemForm.unitAmountDollars),
              billingType: itemForm.billingType,
              billingInterval:
                itemForm.billingType === "recurring"
                  ? itemForm.billingInterval
                  : undefined,
              billingIntervalCount:
                itemForm.billingType === "recurring"
                  ? itemForm.billingIntervalCount
                  : 1,
              discountType:
                itemForm.itemType === "discount"
                  ? "amount"
                  : itemForm.discountType || undefined,
              discountAmountCents:
                itemForm.itemType === "discount"
                  ? dollarsToCents(itemForm.unitAmountDollars)
                  : itemForm.discountType === "amount"
                    ? dollarsToCents(itemForm.discountAmountDollars)
                    : undefined,
              discountPercent:
                itemForm.discountType === "percent"
                  ? Number(itemForm.discountPercent)
                  : undefined,
              discountDurationType:
                (itemForm.discountType && itemForm.billingType === "recurring") ||
                (itemForm.itemType === "discount" &&
                  itemForm.discountScope === DISCOUNT_SCOPE.RECURRING)
                  ? itemForm.discountDurationType
                  : itemForm.itemType === "discount" &&
                      itemForm.discountScope === DISCOUNT_SCOPE.FIRST_CYCLE
                    ? "once"
                    : undefined,
              discountDurationMonths:
                ((itemForm.discountType && itemForm.billingType === "recurring") ||
                  (itemForm.itemType === "discount" &&
                    itemForm.discountScope === DISCOUNT_SCOPE.RECURRING)) &&
                itemForm.discountDurationType === "repeating"
                  ? itemForm.discountDurationMonths
                  : undefined,
              discountScope:
                itemForm.itemType === "discount" || itemForm.itemType === "credit"
                  ? itemForm.discountScope
                  : undefined,
              sortOrder: selected.items.length,
            },
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add item");
      setOffers((current) =>
        current.map((offer) =>
          offer.id === selected.id ? data.offer : offer,
        ),
      );
      setItemForm(EMPTY_ITEM);
      setEditingItemId(null);
      setMessage(editingItemId ? "Custom line item updated." : "Custom line item added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save item");
    } finally {
      setBusy(false);
    }
  }

  function editItem(item: ClientOfferItem) {
    setEditingItemId(item.id);
    setShowAdvancedItems(true);
    setItemForm({
      itemType: item.item_type,
      name: item.name,
      description: item.description ?? "",
      quantity: item.quantity,
      unitAmountDollars: (item.unit_amount_cents / 100).toFixed(2),
      billingType: item.billing_type,
      billingInterval: item.billing_interval === "year" ? "year" : "month",
      billingIntervalCount: item.billing_interval_count || 1,
      discountType: item.discount_type ?? "",
      discountAmountDollars: item.discount_amount_cents
        ? (item.discount_amount_cents / 100).toFixed(2)
        : "",
      discountPercent: item.discount_percent ? String(item.discount_percent) : "",
      discountDurationType: item.discount_duration_type ?? "repeating",
      discountDurationMonths: item.discount_duration_months ?? 6,
      discountScope:
        item.metadata?.discount_scope === DISCOUNT_SCOPE.FIRST_CYCLE
          ? DISCOUNT_SCOPE.FIRST_CYCLE
          : DISCOUNT_SCOPE.RECURRING,
    });
  }

  async function removeItem(item: ClientOfferItem) {
    if (!selected || selected.status !== "draft") return;
    if (
      !window.confirm(
        `Remove line item?\n\n“${item.name}” will be removed from this draft proposal.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/clients/${tenantId}/offers/${selected.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deleteItemId: item.id }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not remove item");
      setOffers((current) =>
        current.map((offer) =>
          offer.id === selected.id ? data.offer : offer,
        ),
      );
      if (editingItemId === item.id) {
        setEditingItemId(null);
        setItemForm(EMPTY_ITEM);
      }
      setMessage("Line item removed. No billing was affected.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove item");
    } finally {
      setBusy(false);
    }
  }

  function renderLineItemList(items: ClientOfferItem[], editable: boolean) {
    if (items.length === 0) {
      return <p className="text-sm text-muted">None</p>;
    }
    return (
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.id} className="py-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-muted">
                  {formatOfferLineItemSubtitle(item)}
                </p>
              </div>
              <p className="shrink-0 font-medium">
                {formatMoney(
                  item.unit_amount_cents * item.quantity,
                  selected?.currency,
                )}
              </p>
              {editable ? (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => editItem(item)}
                    className="text-xs text-muted hover:text-foreground"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeItem(item)}
                    className="text-xs text-danger"
                  >
                    Remove
                  </button>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-6">
      <Panel title="Create Proposal">
        <p className="mb-4 text-sm text-muted">
          Start a draft, then build investment and scope before sending to
          proposal recipients.
        </p>
        <ProposalSection title="Proposal details">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Proposal title"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={shortSummary}
              onChange={(e) => setShortSummary(e.target.value)}
              placeholder="Proposal summary (optional)"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Proposal scope (optional)"
              rows={4}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-2"
            />
          </div>
        </ProposalSection>
        <ProposalSection
          title="Billing"
          description="Choose how the client completes this proposal after acceptance."
        >
          <div className="grid gap-3 md:grid-cols-2">
            {BILLING_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`cursor-pointer rounded-lg border p-4 text-sm ${
                  billingMethod === option.value
                    ? "border-accent bg-accent/5 ring-1 ring-accent"
                    : "border-border"
                }`}
              >
                <span className="flex items-center gap-2 font-medium">
                  <input
                    type="radio"
                    name="new-offer-billing-method"
                    value={option.value}
                    checked={billingMethod === option.value}
                    onChange={() => setBillingMethod(option.value)}
                  />
                  {option.title}
                </span>
                <span className="mt-2 block text-xs leading-5 text-muted">
                  {option.description}
                </span>
              </label>
            ))}
          </div>
        </ProposalSection>
        <Button className="mt-4" onClick={createOffer} disabled={busy}>
          Create & Edit Proposal
        </Button>
      </Panel>

      {offers.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <Panel title="Proposals">
            <ul className="space-y-2">
              {offers.map((offer) => (
                <li key={offer.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(offer.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                      selectedId === offer.id
                        ? "border-foreground bg-background"
                        : "border-border"
                    }`}
                  >
                    <p className="font-medium">{offer.title}</p>
                    <StatusPill
                      label={offerStatusLabel(offer.status)}
                      tone="neutral"
                    />
                    <p className="mt-1 text-xs text-muted">
                      Billing: {offerBillingMethodLabel(offer)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          {selected ? (
            <div className="space-y-6">
              <Panel title={selected.title}>
                <div className="mb-6 flex flex-wrap items-center gap-2">
                  <StatusPill
                    label={offerStatusLabel(selected.status)}
                    tone="warning"
                  />
                  <span className="text-sm font-medium">
                    Billing: {offerBillingMethodLabel(selected)}
                  </span>
                  {selected.status === "accepted" &&
                  resolveOfferBillingMethod(selected) === "proposal_only" ? (
                    <span className="text-sm text-success">
                      Billing handled separately
                    </span>
                  ) : null}
                  <span className="text-sm text-muted">
                    Due at first cycle{" "}
                    {formatMoney(
                      calculateAmountDueFirstCycle({
                        subtotal_cents: selected.subtotal_cents,
                        discount_total_cents: selected.discount_total_cents,
                        initial_total_cents: selected.initial_total_cents,
                        recurring_total_cents: selected.recurring_total_cents,
                      }),
                      selected.currency,
                    )}
                  </span>
                  <span className="text-sm text-muted">
                    One-time{" "}
                    {formatMoney(selected.initial_total_cents, selected.currency)}
                  </span>
                  <span className="text-sm text-muted">
                    Recurring{" "}
                    {formatMoney(
                      selected.recurring_total_cents,
                      selected.currency,
                    )}
                  </span>
                </div>

                {selected.status === "draft" ? (
                  <div className="space-y-6">
                    <ProposalSection title="Proposal details">
                      <div className="grid gap-3">
                        <label className="text-sm">
                          <span className="mb-1 block text-xs font-medium text-muted">
                            Title
                          </span>
                          <input
                            required
                            value={selected.title}
                            onChange={(event) =>
                              updateSelected({ title: event.target.value })
                            }
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="text-sm">
                          <span className="mb-1 block text-xs font-medium text-muted">
                            Summary
                          </span>
                          <input
                            value={selected.short_summary ?? ""}
                            onChange={(event) =>
                              updateSelected({
                                short_summary: event.target.value,
                              })
                            }
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="text-sm">
                          <span className="mb-1 block text-xs font-medium text-muted">
                            Scope
                          </span>
                          <textarea
                            value={selected.description ?? ""}
                            onChange={(event) =>
                              updateSelected({ description: event.target.value })
                            }
                            rows={6}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                          />
                        </label>
                      </div>
                    </ProposalSection>

                    <ProposalSection
                      title="Scope & deliverables"
                      description="Proposal-facing features shown to the client. This is separate from commercial plan inclusions."
                    >
                      <div className="space-y-2">
                        {selected.features.map((feature, index) => (
                          <div key={feature.id} className="flex items-center gap-2">
                            <span className="text-success" aria-hidden="true">
                              ✓
                            </span>
                            <input
                              value={feature.label}
                              onChange={(event) =>
                                updateFeature(index, event.target.value)
                              }
                              className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                              aria-label={`Feature ${index + 1}`}
                            />
                            <button
                              type="button"
                              onClick={() => moveFeature(index, -1)}
                              disabled={index === 0}
                              className="px-1 text-sm text-muted disabled:opacity-30"
                              aria-label={`Move ${feature.label} up`}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => moveFeature(index, 1)}
                              disabled={index === selected.features.length - 1}
                              className="px-1 text-sm text-muted disabled:opacity-30"
                              aria-label={`Move ${feature.label} down`}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => removeFeature(index)}
                              className="text-xs text-muted hover:text-danger"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <input
                          value={newFeature}
                          onChange={(event) => setNewFeature(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              addFeature();
                            }
                          }}
                          placeholder="Add deliverable or feature"
                          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={addFeature}
                        >
                          Add
                        </Button>
                      </div>
                    </ProposalSection>

                    <ProposalSection
                      title="Investment / pricing"
                      description="Build the commercial deal using catalog plans, components, and add-ons."
                    >
                      <CommercialOfferConfigurator
                        plans={plans}
                        platformComponents={platformComponents}
                        serviceAddOns={serviceAddOns}
                        initialConfig={commercialConfig}
                        configVersion={configVersion}
                        busy={busy}
                        onApply={applyCommercialPricing}
                      />
                      {itemPartitions.managed.length > 0 ? (
                        <div className="mt-6 border-t border-border pt-4">
                          <h4 className="text-sm font-medium">
                            Saved commercial line items
                          </h4>
                          {renderLineItemList(itemPartitions.managed, false)}
                        </div>
                      ) : null}
                    </ProposalSection>

                    <ProposalSection title="Billing">
                      <div className="grid gap-3 md:grid-cols-2">
                        {BILLING_OPTIONS.map((option) => (
                          <label
                            key={option.value}
                            className={`cursor-pointer rounded-lg border p-4 text-sm ${
                              resolveOfferBillingMethod(selected) === option.value
                                ? "border-accent bg-accent/5 ring-1 ring-accent"
                                : "border-border"
                            }`}
                          >
                            <span className="flex items-center gap-2 font-medium">
                              <input
                                type="radio"
                                name={`billing-method-${selected.id}`}
                                value={option.value}
                                checked={
                                  resolveOfferBillingMethod(selected) ===
                                  option.value
                                }
                                onChange={() =>
                                  updateSelected({ billing_method: option.value })
                                }
                              />
                              {option.title}
                            </span>
                            <span className="mt-2 block text-xs leading-5 text-muted">
                              {option.description}
                            </span>
                          </label>
                        ))}
                      </div>
                    </ProposalSection>

                    <ProposalSection
                      title="Advanced"
                      description="Add custom or exception line items that are not part of the catalog configuration."
                    >
                      <button
                        type="button"
                        className="text-sm font-medium text-muted hover:text-foreground"
                        onClick={() => setShowAdvancedItems((current) => !current)}
                      >
                        {showAdvancedItems ? "Hide" : "Show"} custom line items
                        {itemPartitions.manual.length > 0
                          ? ` (${itemPartitions.manual.length})`
                          : ""}
                      </button>
                      {itemPartitions.manual.length > 0 ? (
                        <div className="mt-4">
                          {renderLineItemList(itemPartitions.manual, true)}
                        </div>
                      ) : null}
                      {showAdvancedItems ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <select
                            value={itemForm.itemType}
                            onChange={(e) => {
                              const itemType = e.target.value as ClientOfferItemType;
                              setItemForm((current) => ({
                                ...current,
                                itemType,
                                billingType: defaultBillingForItemType(itemType),
                              }));
                            }}
                            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                          >
                            <option value="custom_service">Custom service</option>
                            <option value="setup_fee">Setup fee</option>
                            <option value="add_on">Add-on</option>
                            <option value="discount">Discount</option>
                            <option value="credit">Credit</option>
                          </select>
                          <input
                            value={itemForm.name}
                            onChange={(e) =>
                              setItemForm((current) => ({
                                ...current,
                                name: e.target.value,
                              }))
                            }
                            placeholder="Item name"
                            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                          />
                          <input
                            value={itemForm.unitAmountDollars}
                            onChange={(e) =>
                              setItemForm((current) => ({
                                ...current,
                                unitAmountDollars: e.target.value,
                              }))
                            }
                            placeholder="Amount (USD)"
                            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                          />
                          <select
                            value={itemForm.billingType}
                            onChange={(e) =>
                              setItemForm((current) => ({
                                ...current,
                                billingType: e.target.value as typeof itemForm.billingType,
                              }))
                            }
                            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                          >
                            <option value="one_time">One-time</option>
                            <option value="recurring">Recurring</option>
                          </select>
                          {(itemForm.itemType === "discount" ||
                            itemForm.itemType === "credit") && (
                            <select
                              value={itemForm.discountScope}
                              onChange={(e) =>
                                setItemForm((current) => ({
                                  ...current,
                                  discountScope: e.target.value as typeof itemForm.discountScope,
                                }))
                              }
                              className="rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-2"
                            >
                              <option value={DISCOUNT_SCOPE.FIRST_CYCLE}>
                                First billing cycle only
                              </option>
                              <option value={DISCOUNT_SCOPE.RECURRING}>
                                Reduces monthly recurring
                              </option>
                            </select>
                          )}
                          <div className="flex gap-2 md:col-span-2">
                            <Button onClick={saveItem} disabled={busy}>
                              {editingItemId ? "Save item" : "Add custom line item"}
                            </Button>
                            {editingItemId ? (
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  setEditingItemId(null);
                                  setItemForm(EMPTY_ITEM);
                                }}
                                disabled={busy}
                              >
                                Cancel
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </ProposalSection>

                    <ProposalSection title="Recipients">
                      <SendProposalButton
                        tenantId={tenantId}
                        offerId={selected.id}
                        offerStatus={selected.status}
                        contacts={contacts}
                      />
                      {recipientDeliveries.some(
                        (recipient) => recipient.offer_id === selected.id,
                      ) ? (
                        <div className="mt-4 rounded-lg border border-border p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted">
                            Delivery status
                          </p>
                          <ul className="mt-2 space-y-1 text-sm">
                            {recipientDeliveries
                              .filter(
                                (recipient) => recipient.offer_id === selected.id,
                              )
                              .map((recipient) => (
                                <li
                                  key={recipient.id}
                                  className="flex flex-wrap justify-between gap-2"
                                >
                                  <span>
                                    {recipient.name ?? recipient.email} ·{" "}
                                    {recipient.email}
                                  </span>
                                  <span className="text-muted">
                                    {recipient.delivery_status.replace("_", " ")}
                                    {recipient.viewed_at ? " · viewed" : ""}
                                    {recipient.accepted_at ? " · accepted" : ""}
                                  </span>
                                </li>
                              ))}
                          </ul>
                        </div>
                      ) : null}
                    </ProposalSection>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void saveProposal()}
                        disabled={busy || selected.title.trim().length < 2}
                      >
                        Save draft
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void previewAsClient()}
                        disabled={busy || selected.title.trim().length < 2}
                      >
                        Preview as Client ↗
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-danger hover:text-danger"
                        onClick={() => void deleteDraft()}
                        disabled={busy}
                      >
                        Delete draft
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {(selected.description || selected.features.length > 0) && (
                      <div className="mb-6 border-b border-border pb-6 text-sm">
                        {selected.short_summary ? (
                          <p className="font-medium">{selected.short_summary}</p>
                        ) : null}
                        {selected.description ? (
                          <p className="mt-2 whitespace-pre-wrap text-muted">
                            {selected.description}
                          </p>
                        ) : null}
                        {selected.features.length > 0 ? (
                          <ul className="mt-3 space-y-1">
                            {selected.features.map((feature) => (
                              <li key={feature.id}>✓ {feature.label}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    )}
                    {selected.items.length === 0 ? (
                      <p className="text-sm text-muted">No line items yet.</p>
                    ) : (
                      renderLineItemList(selected.items, false)
                    )}
                    <div className="mt-4">
                      <SendProposalButton
                        tenantId={tenantId}
                        offerId={selected.id}
                        offerStatus={selected.status}
                        contacts={contacts}
                      />
                    </div>
                    {recipientDeliveries.some(
                      (recipient) => recipient.offer_id === selected.id,
                    ) ? (
                      <div className="mt-4 rounded-lg border border-border p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted">
                          Recipient delivery
                        </p>
                        <ul className="mt-2 space-y-1 text-sm">
                          {recipientDeliveries
                            .filter(
                              (recipient) => recipient.offer_id === selected.id,
                            )
                            .map((recipient) => (
                              <li
                                key={recipient.id}
                                className="flex flex-wrap justify-between gap-2"
                              >
                                <span>
                                  {recipient.name ?? recipient.email} ·{" "}
                                  {recipient.email}
                                </span>
                                <span className="text-muted">
                                  {recipient.delivery_status.replace("_", " ")}
                                  {recipient.viewed_at ? " · viewed" : ""}
                                  {recipient.accepted_at ? " · accepted" : ""}
                                </span>
                              </li>
                            ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                )}
              </Panel>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted">
          No proposals yet. Create a proposal above to begin.
        </p>
      )}

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {message ? <p className="text-sm text-success">{message}</p> : null}
    </div>
  );
}
