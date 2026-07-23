/** Hide internal admin notes from client-facing proposal UI. */
export function getClientVisibleOfferDescription(
  description: string | null | undefined,
): string | null {
  if (!description?.trim()) return null;

  const normalized = description.trim().toLowerCase();
  const isInternalNote =
    normalized.includes("source of truth") ||
    normalized.includes("client_offer_items") ||
    normalized.includes("invite client") ||
    normalized.startsWith("commercial agreement created");

  if (isInternalNote) return null;

  return description.trim();
}
