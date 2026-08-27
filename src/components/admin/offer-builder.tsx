"use client";

import { useMemo, useState } from "react";
import type {
  ClientOffer,
  ClientOfferFeature,
  ClientOfferItem,
  ClientOfferItemType,
  ProposalBillingMethod,
} from "@/lib/database/phase1-types";
import {
  offerBillingMethodLabel,
  resolveOfferBillingMethod,
} from "@/lib/offers/billing-method";
import { DISCOUNT_SCOPE } from "@/lib/offers/discount-scope";
import { defaultBillingForItemType } from "@/lib/offers/build-offer-item-payload";
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
  productKey: string;
  quantity: number;
  unitAmountDollars: string;
  billingType: "one_time" | "recurring";
  billingInterval: "day" | "week" | "month" | "year";
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
  itemType: "base_plan",
  name: "",
  description: "",
  productKey: "",
  quantity: 1,
  unitAmountDollars: "",
  billingType: "recurring",
  billingInterval: "month",
  discountType: "",
  discountAmountDollars: "",
  discountPercent: "",
  discountDurationType: "repeating",
  discountDurationMonths: 6,
  discountScope: DISCOUNT_SCOPE.RECURRING,
};

function dollarsToCents(value: string): number {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

export function OfferBuilder({
  tenantId,
  initialOffers,
  ownerEmail,
}: {
  tenantId: string;
  initialOffers: OfferWithItems[];
  ownerEmail?: string | null;
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selected = useMemo(
    () => offers.find((offer) => offer.id === selectedId) ?? null,
    [offers, selectedId],
  );

  async function refreshOffers(selectId?: string) {
    const res = await fetch(`/api/admin/clients/${tenantId}/offers`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not load offers");
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
      if (!res.ok) throw new Error(data.error ?? "Could not create offer");
      setTitle("");
      setShortSummary("");
      setDescription("");
      setBillingMethod("stripe_checkout");
      await refreshOffers(data.offer.id);
      setMessage("Draft offer created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create offer");
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

  async function addItem() {
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
            addItem: {
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
              productKey: itemForm.productKey.trim() || undefined,
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
      setMessage("Line item added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add item");
    } finally {
      setBusy(false);
    }
  }

  async function publishOffer() {
    if (!selected) return;
    if (!(await saveProposal())) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/clients/${tenantId}/offers/${selected.id}/publish`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not publish offer");
      await refreshOffers(selected.id);
      setMessage("Offer published. Client can review it in the portal.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish offer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Panel title="Create draft offer">
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
            placeholder="Short summary (optional)"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed description / scope (optional)"
            rows={4}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-2"
          />
        </div>
        <fieldset className="mt-4">
          <legend className="text-xs font-semibold tracking-wide text-muted uppercase">
            Billing method
          </legend>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {(
              [
                {
                  value: "stripe_checkout",
                  title: "Stripe Checkout",
                  description:
                    "Client accepts the proposal and continues to Stripe for payment or subscription setup.",
                },
                {
                  value: "proposal_only",
                  title: "Proposal Only",
                  description:
                    "Client accepts the proposal without making any Stripe changes. Billing will be handled separately.",
                },
              ] as const
            ).map((option) => (
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
        </fieldset>
        <Button className="mt-4" onClick={createOffer} disabled={busy}>
          Create draft
        </Button>
      </Panel>

      {offers.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <Panel title="Offers">
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
                    <StatusPill label={offer.status} tone="neutral" />
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
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <StatusPill label={selected.status} tone="warning" />
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
                    {formatMoney(
                      selected.initial_total_cents,
                      selected.currency,
                    )}
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
                  <div className="mb-6 space-y-5 border-b border-border pb-6">
                    <div className="grid gap-3">
                      <label className="text-sm">
                        <span className="mb-1 block text-xs font-medium text-muted">
                          Proposal title
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
                          Short summary
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
                          Detailed description / overview
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

                    <fieldset>
                      <legend className="text-sm font-semibold">Billing method</legend>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {(
                          [
                            {
                              value: "stripe_checkout",
                              title: "Stripe Checkout",
                              description:
                                "Client accepts the proposal and continues to Stripe for payment or subscription setup.",
                            },
                            {
                              value: "proposal_only",
                              title: "Proposal Only",
                              description:
                                "Client accepts the proposal without making any Stripe changes. Billing will be handled separately.",
                            },
                          ] as const
                        ).map((option) => (
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
                                  resolveOfferBillingMethod(selected) === option.value
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
                    </fieldset>

                    <div>
                      <h3 className="text-sm font-semibold">What&apos;s Included</h3>
                      <div className="mt-3 space-y-2">
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
                          placeholder="Add feature"
                          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                        />
                        <Button type="button" variant="secondary" onClick={addFeature}>
                          Add feature
                        </Button>
                      </div>
                    </div>

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
                ) : selected.description || selected.features.length > 0 ? (
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
                ) : null}

                {selected.items.length === 0 ? (
                  <p className="text-sm text-muted">No line items yet.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {selected.items.map((item) => (
                      <li key={item.id} className="py-3 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-xs text-muted">
                              {formatOfferLineItemSubtitle(item)}
                            </p>
                          </div>
                          <p className="font-medium">
                            {formatMoney(
                              item.unit_amount_cents * item.quantity,
                              selected.currency,
                            )}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {selected.status === "draft" ? (
                  <Button
                    className="mt-4"
                    onClick={publishOffer}
                    disabled={busy || selected.items.length === 0}
                  >
                    Publish offer
                  </Button>
                ) : (
                  <div className="mt-4">
                    <SendProposalButton
                      tenantId={tenantId}
                      offerId={selected.id}
                      offerStatus={selected.status}
                      ownerEmail={ownerEmail}
                    />
                  </div>
                )}
              </Panel>

              {selected.status === "draft" ? (
                <Panel title="Add line item">
                  <div className="grid gap-3 md:grid-cols-2">
                    <select
                      value={itemForm.itemType}
                      onChange={(e) => {
                        const itemType = e.target.value as ClientOfferItemType;
                        setItemForm((current) => ({
                          ...current,
                          itemType,
                          billingType: defaultBillingForItemType(itemType),
                          unitAmountDollars:
                            itemType === "product" ? "0" : current.unitAmountDollars,
                        }));
                      }}
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                      <option value="base_plan">Base plan</option>
                      <option value="setup_fee">Setup fee</option>
                      <option value="add_on">Add-on (paid)</option>
                      <option value="product">Included product</option>
                      <option value="custom_service">Custom service</option>
                      <option value="discount">Discount</option>
                      <option value="credit">Credit</option>
                    </select>
                    <input
                      value={itemForm.productKey}
                      onChange={(e) =>
                        setItemForm((current) => ({
                          ...current,
                          productKey: e.target.value,
                        }))
                      }
                      placeholder="Catalog product key (optional)"
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
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
                      <option value="recurring">Recurring</option>
                      <option value="one_time">One-time</option>
                    </select>
                    {itemForm.billingType === "recurring" &&
                    itemForm.itemType !== "discount" &&
                    itemForm.itemType !== "credit" ? (
                      <select
                        value={itemForm.discountType}
                        onChange={(e) =>
                          setItemForm((current) => ({
                            ...current,
                            discountType: e.target.value as typeof itemForm.discountType,
                          }))
                        }
                        className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                      >
                        <option value="">No discount</option>
                        <option value="percent">Percent discount</option>
                        <option value="amount">Amount discount</option>
                      </select>
                    ) : null}
                    {itemForm.discountType === "percent" ? (
                      <input
                        value={itemForm.discountPercent}
                        onChange={(e) =>
                          setItemForm((current) => ({
                            ...current,
                            discountPercent: e.target.value,
                          }))
                        }
                        placeholder="Discount percent"
                        className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                      />
                    ) : null}
                    {itemForm.discountType === "amount" ? (
                      <input
                        value={itemForm.discountAmountDollars}
                        onChange={(e) =>
                          setItemForm((current) => ({
                            ...current,
                            discountAmountDollars: e.target.value,
                          }))
                        }
                        placeholder="Discount amount (USD)"
                        className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                      />
                    ) : null}
                    {itemForm.itemType === "discount" ||
                    itemForm.itemType === "credit" ? (
                      <select
                        value={itemForm.discountScope}
                        onChange={(e) =>
                          setItemForm((current) => ({
                            ...current,
                            discountScope: e.target.value as typeof itemForm.discountScope,
                          }))
                        }
                        className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                      >
                        <option value={DISCOUNT_SCOPE.RECURRING}>
                          Reduces monthly recurring
                        </option>
                        <option value={DISCOUNT_SCOPE.FIRST_CYCLE}>
                          First billing cycle only
                        </option>
                      </select>
                    ) : null}
                    {itemForm.itemType === "discount" &&
                    itemForm.discountScope === DISCOUNT_SCOPE.RECURRING ? (
                      <>
                        <select
                          value={itemForm.discountDurationType}
                          onChange={(e) =>
                            setItemForm((current) => ({
                              ...current,
                              discountDurationType: e.target
                                .value as typeof itemForm.discountDurationType,
                            }))
                          }
                          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                        >
                          <option value="forever">Discount forever</option>
                          <option value="repeating">
                            Discount for limited months
                          </option>
                        </select>
                        {itemForm.discountDurationType === "repeating" ? (
                          <input
                            type="number"
                            min={1}
                            max={120}
                            value={itemForm.discountDurationMonths}
                            onChange={(e) =>
                              setItemForm((current) => ({
                                ...current,
                                discountDurationMonths: Number.parseInt(
                                  e.target.value,
                                  10,
                                ) || 1,
                              }))
                            }
                            placeholder="Months"
                            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                          />
                        ) : null}
                      </>
                    ) : null}
                  </div>
                  <Button className="mt-4" onClick={addItem} disabled={busy}>
                    Add item
                  </Button>
                </Panel>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {message ? <p className="text-sm text-success">{message}</p> : null}
    </div>
  );
}
