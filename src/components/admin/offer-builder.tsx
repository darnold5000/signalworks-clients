"use client";

import { useMemo, useState } from "react";
import type { ClientOffer, ClientOfferItem } from "@/lib/database/phase1-types";
import { Button, Panel, StatusPill } from "@/components/ui";
import { formatMoney } from "@/lib/utils";

type OfferWithItems = ClientOffer & { items: ClientOfferItem[] };

const EMPTY_ITEM = {
  itemType: "base_plan" as const,
  name: "",
  description: "",
  quantity: 1,
  unitAmountDollars: "",
  billingType: "recurring" as const,
  billingInterval: "month" as const,
  discountType: "" as "" | "amount" | "percent",
  discountAmountDollars: "",
  discountPercent: "",
  discountDurationType: "repeating" as const,
  discountDurationMonths: 6,
};

function dollarsToCents(value: string): number {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

export function OfferBuilder({
  tenantId,
  initialOffers,
}: {
  tenantId: string;
  initialOffers: OfferWithItems[];
}) {
  const [offers, setOffers] = useState(initialOffers);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialOffers[0]?.id ?? null,
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [itemForm, setItemForm] = useState(EMPTY_ITEM);
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
          description: description || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create offer");
      setTitle("");
      setDescription("");
      await refreshOffers(data.offer.id);
      setMessage("Draft offer created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create offer");
    } finally {
      setBusy(false);
    }
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
              discountType: itemForm.discountType || undefined,
              discountAmountCents: itemForm.discountType === "amount"
                ? dollarsToCents(itemForm.discountAmountDollars)
                : undefined,
              discountPercent:
                itemForm.discountType === "percent"
                  ? Number(itemForm.discountPercent)
                  : undefined,
              discountDurationType:
                itemForm.discountType && itemForm.billingType === "recurring"
                  ? itemForm.discountDurationType
                  : undefined,
              discountDurationMonths:
                itemForm.discountType &&
                itemForm.billingType === "recurring" &&
                itemForm.discountDurationType === "repeating"
                  ? itemForm.discountDurationMonths
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
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description (optional)"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
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
                  <span className="text-sm text-muted">
                    Due today{" "}
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
                              {item.item_type} · {item.billing_type}
                              {item.billing_interval
                                ? ` / ${item.billing_interval}`
                                : ""}
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
                ) : null}
              </Panel>

              {selected.status === "draft" ? (
                <Panel title="Add line item">
                  <div className="grid gap-3 md:grid-cols-2">
                    <select
                      value={itemForm.itemType}
                      onChange={(e) =>
                        setItemForm((current) => ({
                          ...current,
                          itemType: e.target.value as typeof itemForm.itemType,
                        }))
                      }
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                      <option value="base_plan">Base plan</option>
                      <option value="setup_fee">Setup fee</option>
                      <option value="add_on">Add-on</option>
                      <option value="custom_service">Custom service</option>
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
                      <option value="recurring">Recurring</option>
                      <option value="one_time">One-time</option>
                    </select>
                    {itemForm.billingType === "recurring" ? (
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
