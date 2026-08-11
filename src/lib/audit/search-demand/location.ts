export type GoogleAdsLocation = {
  locationCode: number;
  locationName: string;
  countryIsoCode: string | null;
  locationType: string | null;
};

type GoogleAdsLocationRecord = {
  location_code?: number;
  location_name?: string;
  country_iso_code?: string;
  location_type?: string;
};

type GoogleAdsLocationsResponse = {
  status_code?: number;
  status_message?: string;
  tasks?: Array<{
    status_code?: number;
    status_message?: string;
    result?: GoogleAdsLocationRecord[];
  }>;
};

import { normalizeState } from "@/lib/audit/location-input";

function normalizeLocationPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function matchGoogleAdsLocations(locations: GoogleAdsLocationRecord[] | undefined, input: { city: string | null; state: string | null }): GoogleAdsLocation[] {
  if (!input.city) return [];
  const city = normalizeLocationPart(input.city);
  const state = normalizeLocationPart(normalizeState(input.state));
  return (locations ?? []).filter((location) => {
    if (!location.location_code || !location.location_name || location.country_iso_code?.toUpperCase() !== "US") return false;
    const [locationCity, locationState] = location.location_name.split(",");
    return normalizeLocationPart(locationCity ?? "") === city
      && (!state || normalizeLocationPart(locationState ?? "") === state)
      && /city|town|municipality/i.test(location.location_type ?? "");
  }).filter((location): location is GoogleAdsLocationRecord & { location_code: number; location_name: string } => Boolean(location.location_code && location.location_name)).map((location) => ({ locationCode: location.location_code, locationName: location.location_name, countryIsoCode: location.country_iso_code ?? null, locationType: location.location_type ?? null }));
}

export function matchGoogleAdsLocation(locations: GoogleAdsLocationRecord[] | undefined, input: { city: string | null; state: string | null }): GoogleAdsLocation | null {
  const matches = matchGoogleAdsLocations(locations, input);
  return matches.length === 1 ? matches[0] : null;
}

let usGoogleAdsLocationsPromise: Promise<GoogleAdsLocationRecord[] | undefined> | null = null;

async function fetchUsGoogleAdsLocations(): Promise<GoogleAdsLocationRecord[] | undefined> {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) throw new Error("DataForSEO credentials are not configured.");
  const response = await fetch("https://api.dataforseo.com/v3/keywords_data/google_ads/locations/us", {
    headers: { Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`DataForSEO Google Ads locations HTTP ${response.status}`);
  const payload = (await response.json()) as GoogleAdsLocationsResponse;
  const task = payload.tasks?.[0];
  if (payload.status_code !== 20000 || task?.status_code !== 20000) throw new Error(task?.status_message ?? payload.status_message ?? "DataForSEO Google Ads locations failed.");
  return task.result ?? [];
}

export async function resolveGoogleAdsLocation(input: { city: string | null; state: string | null; auditId?: string }): Promise<GoogleAdsLocation | null> {
  if (!input.city) {
    console.warn("[audit/search-demand] Google Ads location unavailable: city is required", { auditId: input.auditId, city: input.city, state: input.state });
    return null;
  }
  usGoogleAdsLocationsPromise ??= fetchUsGoogleAdsLocations();
  try {
    const matches = matchGoogleAdsLocations(await usGoogleAdsLocationsPromise, input);
    if (matches.length > 1 && !input.state) {
      console.warn("[audit/search-demand] Google Ads city location is ambiguous", { auditId: input.auditId, city: input.city, candidates: matches.map((match) => match.locationName) });
      return null;
    }
    const location = matches[0];
    if (!location) {
      console.warn("[audit/search-demand] Google Ads city location not found", { auditId: input.auditId, city: input.city, state: input.state });
      return null;
    }
    console.info("[audit/search-demand] Google Ads location resolved", { auditId: input.auditId, locationCode: location.locationCode, locationName: location.locationName, locationType: location.locationType });
    return location;
  } catch (error) {
    usGoogleAdsLocationsPromise = null;
    console.warn("[audit/search-demand] Google Ads location resolution failed", { auditId: input.auditId, city: input.city, state: input.state, error: error instanceof Error ? error.message : error });
    return null;
  }
}
