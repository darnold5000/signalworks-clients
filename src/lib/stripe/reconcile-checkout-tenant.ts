export function reconcileCheckoutTenant(ids: {
  metadataTenantId: string | null;
  purchaseTenantId?: string | null;
  offerTenantId?: string | null;
}): string | null {
  const loaded: Array<string | null> = [];
  if (ids.purchaseTenantId !== undefined) loaded.push(ids.purchaseTenantId);
  if (ids.offerTenantId !== undefined) loaded.push(ids.offerTenantId);

  if (loaded.some((id) => !id)) return null;

  const defined = [
    ...loaded.filter((id): id is string => Boolean(id)),
    ids.metadataTenantId,
  ].filter((id): id is string => Boolean(id));

  if (defined.length === 0) return null;
  const first = defined[0];
  if (defined.some((id) => id !== first)) return null;
  return first;
}
