type LocalItem = {
  type?: string;
  rank_group?: number;
  rank_absolute?: number;
  title?: string;
  domain?: string;
  url?: string;
};

type LocalResponse = {
  status_code?: number;
  status_message?: string;
  tasks?: Array<{ status_code?: number; status_message?: string; result?: Array<{ items?: LocalItem[] }> }>;
};

export async function fetchGoogleLocalResults(input: { keyword: string; locationCode: number; locationName: string }): Promise<LocalItem[]> {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) throw new Error("DataForSEO credentials are not configured.");
  const response = await fetch("https://api.dataforseo.com/v3/serp/google/local_finder/live/advanced", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`, "Content-Type": "application/json" },
    body: JSON.stringify([{ keyword: input.keyword, location_code: input.locationCode, language_code: "en", device: "desktop", depth: 20 }]),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`DataForSEO local HTTP ${response.status}`);
  const payload = (await response.json()) as LocalResponse;
  const task = payload.tasks?.[0];
  if (payload.status_code !== 20000 || !task || task.status_code !== 20000) throw new Error(task?.status_message ?? payload.status_message ?? "DataForSEO local search failed.");
  return (task.result?.[0]?.items ?? []).filter((item) => item.type === "local_pack");
}
