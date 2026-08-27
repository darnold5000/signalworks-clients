import type { ClientOfferItem } from "@/lib/database/phase1-types";

export type BillingInterval = "month" | "year";

export function recurringCadence(item: Pick<ClientOfferItem, "billing_interval" | "billing_interval_count">) {
  return {
    interval: (item.billing_interval === "year" ? "year" : "month") as BillingInterval,
    intervalCount: Math.max(1, item.billing_interval_count || 1),
  };
}

export function cadenceKey(item: Pick<ClientOfferItem, "billing_interval" | "billing_interval_count">): string {
  const cadence = recurringCadence(item);
  return `${cadence.interval}:${cadence.intervalCount}`;
}

export function cadenceSuffix(item: Pick<ClientOfferItem, "billing_interval" | "billing_interval_count">): string {
  const { interval, intervalCount } = recurringCadence(item);
  if (intervalCount === 1) return `/${interval}`;
  return ` every ${intervalCount} ${interval}s`;
}

export function cadenceDescription(item: Pick<ClientOfferItem, "billing_interval" | "billing_interval_count">): string {
  const { interval, intervalCount } = recurringCadence(item);
  if (interval === "year" && intervalCount === 1) return "Billed annually";
  if (interval === "month" && intervalCount === 1) return "Billed monthly";
  return `Billed every ${intervalCount} ${interval}${intervalCount === 1 ? "" : "s"}`;
}

export function cadenceAggregateLabel(item: Pick<ClientOfferItem, "billing_interval" | "billing_interval_count">): string {
  const { interval, intervalCount } = recurringCadence(item);
  if (intervalCount === 1) return interval === "year" ? "Recurring annually" : "Recurring monthly";
  return `Recurring every ${intervalCount} ${interval}s`;
}
