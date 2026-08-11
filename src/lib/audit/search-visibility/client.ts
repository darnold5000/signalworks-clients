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
export type DataForSeoLocationResolution = { status: "resolved"; location: DataForSeoLocation } | { status: "ambiguous"; city: string; candidates: string[] } | { status: "unavailable"; reason: string };

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

import { normalizeState } from "@/lib/audit/location-input";

function normalizeLocationPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function matchUsLocations(locations: DataForSeoLocationRecord[] | undefined, input: { city: string | null; state: string | null }): DataForSeoLocation[] {
  if (!input.city) return [];
  const city = normalizeLocationPart(input.city);
  const state = normalizeLocationPart(normalizeState(input.state));
  return (locations ?? []).filter((location) => {
    if (!location.location_code || !location.location_name || location.country_iso_code?.toUpperCase() !== "US") return false;
    const [locationCity, locationState] = location.location_name.split(",");
    return normalizeLocationPart(locationCity ?? "") === city
      && (!state || normalizeLocationPart(locationState ?? "") === state)
      && /city|town|municipality/i.test(location.location_type ?? "");
  }).filter((location): location is DataForSeoLocationRecord & { location_code: number; location_name: string } => Boolean(location.location_code && location.location_name)).map((location) => ({ locationCode: location.location_code, locationName: location.location_name, locationType: location.location_type ?? "City" }));
}

export function matchUsLocation(locations: DataForSeoLocationRecord[] | undefined, input: { city: string | null; state: string | null }): DataForSeoLocation | null {
  const matches = matchUsLocations(locations, input);
  return matches.length === 1 ? matches[0] : null;
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

export async function resolveDataForSeoLocation(input: { city: string | null; state: string | null }): Promise<DataForSeoLocationResolution> {
  if (!input.city) return { status: "unavailable", reason: "A primary city is required." };
  usLocationsPromise ??= fetchUsLocations();
  try {
    const matches = matchUsLocations(await usLocationsPromise, input);
    if (matches.length === 1) return { status: "resolved", location: matches[0] };
    if (matches.length > 1 && !input.state) return { status: "ambiguous", city: input.city, candidates: matches.map((match) => match.locationName) };
    console.warn("[audit/search-visibility] DataForSEO city not found", input);
    return { status: "unavailable", reason: `No clear DataForSEO city match was found for ${input.city}.` };
  } catch (error) {
    usLocationsPromise = null;
    console.warn("[audit/search-visibility] DataForSEO city location lookup failed", error instanceof Error ? error.message : error);
    return { status: "unavailable", reason: error instanceof Error ? error.message : "DataForSEO location lookup failed." };
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

type DataForSeoScreenshotResponse = { status_code?: number; status_message?: string; tasks?: Array<{ status_code?: number; status_message?: string; result?: Array<{ url?: string; image_url?: string; screenshot_url?: string }> }> };

export async function fetchGoogleSerpScreenshot(taskId: string): Promise<Buffer> {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) throw new Error("DataForSEO credentials are not configured.");
  const response = await fetch("https://api.dataforseo.com/v3/serp/screenshot", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`, "Content-Type": "application/json" },
    body: JSON.stringify([{ task_id: taskId, browser_screen_scale_factor: 1 }]),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`DataForSEO screenshot HTTP ${response.status}`);
  const payload = (await response.json()) as DataForSeoScreenshotResponse;
  const task = payload.tasks?.[0];
  const imageUrl = task?.result?.[0]?.image_url ?? task?.result?.[0]?.screenshot_url ?? task?.result?.[0]?.url;
  if (payload.status_code !== 20000 || !task || task.status_code !== 20000 || !imageUrl) throw new Error(task?.status_message ?? payload.status_message ?? "DataForSEO screenshot was unavailable.");
  const image = await fetch(imageUrl, { signal: AbortSignal.timeout(45_000) });
  if (!image.ok) throw new Error(`Screenshot download HTTP ${image.status}`);
  return Buffer.from(await image.arrayBuffer());
}
