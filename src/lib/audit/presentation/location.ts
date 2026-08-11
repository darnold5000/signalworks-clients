export function formatLocationName(value: string | null | undefined): string | null {
  if (!value) return null;
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}
