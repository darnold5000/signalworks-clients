export type OrganicItem = { type?: string; rank_absolute?: number; rank_group?: number; url?: string };

export type DataForSeoOrganicResponse = {
  status_code?: number;
  status_message?: string;
  tasks_count?: number;
  tasks_error?: number;
  cost?: number;
  tasks?: Array<{
    id?: string;
    task_id?: string;
    status_code?: number;
    status_message?: string;
    cost?: number;
    result?: Array<{ items?: OrganicItem[] }>;
  }>;
};

export type DataForSeoOrganicFetch = {
  items: OrganicItem[];
  resultCount: number;
  itemTypes: Record<string, number>;
  taskId: string | null;
  resultDepth: number;
};

export type DataForSeoLocation = {
  locationCode: number;
  locationName: string;
  locationType: string;
};

type DataForSeoLocationRecord = {
  location_code?: number;
  location_name?: string;
  location_type?: string;
  country_iso_code?: string;
};

type DataForSeoLocationsResponse = {
  status_code?: number;
  status_message?: string;
  tasks?: Array<{
    status_code?: number;
    status_message?: string;
    result?: DataForSeoLocationRecord[];
  }>;
};

const US_STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

function normalizeLocationPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function matchUsLocation(locations: DataForSeoLocationRecord[] | undefined, input: { city: string | null; state: string | null }): DataForSeoLocation | null {
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
    ? { locationCode: match.location_code, locationName: match.location_name, locationType: match.location_type ?? "City" }
    : null;
}

let usLocationsPromise: Promise<DataForSeoLocationRecord[] | undefined> | null = null;

async function fetchUsLocations(): Promise<DataForSeoLocationRecord[] | undefined> {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) throw new Error("DataForSEO credentials are not configured.");
  const response = await fetch("https://api.dataforseo.com/v3/serp/google/locations/us", {
    headers: {
      Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`DataForSEO locations HTTP ${response.status}`);
  const payload = (await response.json()) as DataForSeoLocationsResponse;
  if (payload.status_code !== 20000 || payload.tasks?.[0]?.status_code !== 20000) {
    throw new Error(payload.status_message ?? payload.tasks?.[0]?.status_message ?? "DataForSEO locations failed.");
  }
  return payload.tasks?.[0]?.result ?? [];
}

export async function resolveDataForSeoLocation(input: { city: string | null; state: string | null }): Promise<DataForSeoLocation> {
  const fallback: DataForSeoLocation = { locationCode: 2840, locationName: "United States", locationType: "Country" };
  if (!input.city) return fallback;
  usLocationsPromise ??= fetchUsLocations();
  try {
    const match = matchUsLocation(await usLocationsPromise, input);
    if (match) return match;
    console.warn("[audit/search-visibility] DataForSEO city not found; using country fallback", input);
    return fallback;
  } catch (error) {
    usLocationsPromise = null;
    console.warn("[audit/search-visibility] DataForSEO location lookup failed; using country fallback", error instanceof Error ? error.message : error);
    return fallback;
  }
}

export async function fetchGoogleOrganicResults(input: { keyword: string; locationCode: number; locationName: string }): Promise<DataForSeoOrganicFetch> {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) throw new Error("DataForSEO credentials are not configured.");

  const response = await fetch("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{
      keyword: input.keyword,
      location_code: input.locationCode,
      language_code: "en",
      device: "desktop",
      depth: 30,
    }]),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`DataForSEO HTTP ${response.status}`);
  const payload = (await response.json()) as DataForSeoOrganicResponse;
  console.info("[audit/search-visibility] DataForSEO response", {
    query: input.keyword,
    location: input.locationName,
    httpStatus: response.status,
    statusCode: payload.status_code ?? null,
    statusMessage: payload.status_message ?? null,
    tasksCount: payload.tasks_count ?? payload.tasks?.length ?? 0,
    tasksError: payload.tasks_error ?? 0,
    tasks: (payload.tasks ?? []).map((task) => ({
      statusCode: task.status_code ?? null,
      statusMessage: task.status_message ?? null,
      resultCount: task.result?.length ?? 0,
      cost: task.cost ?? null,
    })),
  });
  if (payload.status_code !== 20000) {
    throw new Error(payload.status_message ?? "DataForSEO returned an unsuccessful response.");
  }
  const task = payload.tasks?.[0];
  if (!task || task.status_code !== 20000) throw new Error(task?.status_message ?? "DataForSEO returned an invalid task.");
  const items = task.result?.flatMap((result) => result.items ?? []) ?? [];
  const itemTypes = items.reduce<Record<string, number>>((counts, item) => {
    const type = item.type ?? "unknown";
    counts[type] = (counts[type] ?? 0) + 1;
    return counts;
  }, {});
  return { items, resultCount: task.result?.length ?? 0, itemTypes, taskId: task.id ?? task.task_id ?? null, resultDepth: 30 };
}
