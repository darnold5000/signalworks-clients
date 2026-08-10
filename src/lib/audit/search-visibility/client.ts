type OrganicItem = { type?: string; rank_absolute?: number; url?: string };

export type DataForSeoOrganicResponse = {
  tasks?: Array<{ status_code?: number; status_message?: string; result?: Array<{ items?: OrganicItem[] }> }>;
};

export async function fetchGoogleOrganicResults(input: { keyword: string; locationName: string }): Promise<OrganicItem[]> {
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
  const task = payload.tasks?.[0];
  if (!task || (task.status_code != null && task.status_code !== 20000)) throw new Error(task?.status_message ?? "DataForSEO returned an invalid task.");
  return task.result?.[0]?.items ?? [];
}
