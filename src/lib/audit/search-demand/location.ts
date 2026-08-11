export type GoogleAdsLocation = {
  locationCode: number;
  locationName: string;
  countryIsoCode: string | null;
  locationType: string | null;
};
export type GoogleAdsLocationResolution =
  | { status: "resolved"; location: GoogleAdsLocation; error: null }
  | { status: "ambiguous" | "not_found" | "provider_error" | "unavailable"; location: null; error: string };

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

export async function resolveGoogleAdsLocation(input: { city: string | null; state: string | null; auditId?: string; requestedMarket?: string | null }): Promise<GoogleAdsLocationResolution> {
  const metadata = { auditId: input.auditId, requestedMarket: input.requestedMarket ?? null, requestedCity: input.city, requestedState: input.state };
  if (!input.city) {
    console.warn("[audit/search-demand] Google Ads location unavailable: city is required", metadata);
    return { status: "unavailable", location: null, error: "A city is required for localized demand." };
  }
  const login = process.env.DATAFORSEO_LOGIN?.trim() ?? "";
  const password = process.env.DATAFORSEO_PASSWORD?.trim() ?? "";
  console.info("[audit/search-demand] Google Ads location resolution started", {
    ...metadata,
    endpoint: "/v3/keywords_data/google_ads/locations/us",
    credentialsPresent: Boolean(login && password),
    loginLength: login.length,
    passwordLength: password.length,
  });
  usGoogleAdsLocationsPromise ??= fetchUsGoogleAdsLocations();
  try {
    const matches = matchGoogleAdsLocations(await usGoogleAdsLocationsPromise, input);
    if (matches.length > 1 && !input.state) {
      const error = `Multiple Google Ads city locations matched ${input.city}.`;
      console.warn("[audit/search-demand] Google Ads city location is ambiguous", { ...metadata, candidates: matches.map((match) => match.locationName) });
      return { status: "ambiguous", location: null, error };
    }
    const location = matches[0];
    if (!location) {
      const error = `No Google Ads city location matched ${input.city}${input.state ? `, ${input.state}` : ""}.`;
      console.warn("[audit/search-demand] Google Ads city location not found", { ...metadata, resolutionStatus: "not_found" });
      return { status: "not_found", location: null, error };
    }
    console.info("[audit/search-demand] Google Ads location resolved", { ...metadata, resolutionStatus: "resolved", locationCode: location.locationCode, locationName: location.locationName, locationType: location.locationType, countryIsoCode: location.countryIsoCode });
    return { status: "resolved", location, error: null };
  } catch (error) {
    usGoogleAdsLocationsPromise = null;
    const message = error instanceof Error ? error.message : "Google Ads location catalog request failed.";
    console.warn("[audit/search-demand] Google Ads location resolution failed", { ...metadata, resolutionStatus: "provider_error", error: message });
    return { status: "provider_error", location: null, error: message };
  }
}
