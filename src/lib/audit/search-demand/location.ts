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

const US_STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", MA: "Massachusetts", MD: "Maryland", MI: "Michigan", MN: "Minnesota", MO: "Missouri", MS: "Mississippi", NC: "North Carolina", ND: "North Dakota", NE: "Nebraska", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NV: "Nevada", NY: "New York", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VA: "Virginia", VT: "Vermont", WA: "Washington", WI: "Wisconsin", WV: "West Virginia",
};

function normalizeLocationPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function matchGoogleAdsLocation(locations: GoogleAdsLocationRecord[] | undefined, input: { city: string | null; state: string | null }): GoogleAdsLocation | null {
  if (!input.city) return null;
  const city = normalizeLocationPart(input.city);
  const state = normalizeLocationPart(US_STATE_NAMES[input.state?.toUpperCase() ?? ""] ?? input.state ?? "");
  const match = (locations ?? []).find((location) => {
    if (!location.location_code || !location.location_name || location.country_iso_code?.toUpperCase() !== "US") return false;
    const [locationCity, locationState] = location.location_name.split(",");
    return normalizeLocationPart(locationCity ?? "") === city
      && (!state || normalizeLocationPart(locationState ?? "") === state)
      && /city|town|municipality/i.test(location.location_type ?? "");
  });
  return match?.location_code && match.location_name
    ? { locationCode: match.location_code, locationName: match.location_name, countryIsoCode: match.country_iso_code ?? null, locationType: match.location_type ?? null }
    : null;
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
    const location = matchGoogleAdsLocation(await usGoogleAdsLocationsPromise, input);
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
