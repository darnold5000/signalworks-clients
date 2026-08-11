export function formatLocationName(value: string | null | undefined): string | null {
  if (!value) return null;
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export function formatSearchQuery(query: string, location: string | null | undefined): string {
  const formattedLocation = formatLocationName(location);
  if (!formattedLocation) return query;
  const displayLocation = formattedLocation.replace(/,\s*United States$/i, "");
  const locationTerms = displayLocation.split(",").map((part) => part.trim()).filter(Boolean);
  const candidates = [displayLocation, locationTerms.join(" "), locationTerms[0]].filter(Boolean).sort((a, b) => b.length - a.length);
  const suffix = candidates.find((candidate) => query.trim().toLowerCase().endsWith(candidate.toLowerCase()));
  if (!suffix) return query;
  const base = query.trim().slice(0, -suffix.length).trim().replace(/[,-]+\s*$/, "");
  return base ? `${base} — ${displayLocation}` : query;
}

export function formatSearchDemand(level: string | undefined, monthlySearchVolume: number | null | undefined): string {
  const label = level === "high" ? "High demand" : level === "moderate" ? "Moderate demand" : level === "low" ? "Low demand" : level === "very_low" ? "Very low demand" : "Not available";
  return monthlySearchVolume == null ? label : `${label} · ~${monthlySearchVolume.toLocaleString()} searches/month`;
}
