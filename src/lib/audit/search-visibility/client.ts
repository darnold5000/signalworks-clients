export type OrganicItem = { type?: string; rank_absolute?: number; rank_group?: number; url?: string };

export type DataForSeoOrganicResponse = {
  status_code?: number;
  status_message?: string;
  tasks_count?: number;
  tasks_error?: number;
  cost?: number;
  tasks?: Array<{
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
};

export async function fetchGoogleOrganicResults(input: { keyword: string; locationName: string }): Promise<DataForSeoOrganicFetch> {
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
      location_name: input.locationName,
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
  return { items, resultCount: task.result?.length ?? 0, itemTypes };
}
