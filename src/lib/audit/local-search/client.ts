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
  tasks?: Array<{ id?: string; task_id?: string; status_code?: number; status_message?: string; result?: Array<{ items?: LocalItem[] }> | null }>;
};

type LocalTask = NonNullable<LocalResponse["tasks"]>[number];

export function isValidLocalNoResultsTask(task: LocalTask): boolean {
  return task.status_code === 40102 && task.status_message === "No Search Results.";
}

export async function fetchGoogleLocalResults(input: { keyword: string; locationCode: number; locationName: string }): Promise<{ items: LocalItem[]; taskId: string | null; resultDepth: number }> {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) throw new Error("DataForSEO credentials are not configured.");
  console.info("[audit/local-search] DataForSEO request", { keyword: input.keyword, locationCode: input.locationCode, locationName: input.locationName, device: "desktop", depth: 20 });
  const response = await fetch("https://api.dataforseo.com/v3/serp/google/local_finder/live/advanced", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`, "Content-Type": "application/json" },
    body: JSON.stringify([{ keyword: input.keyword, location_code: input.locationCode, language_code: "en", device: "desktop", depth: 20 }]),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`DataForSEO local HTTP ${response.status}`);
  const payload = (await response.json()) as LocalResponse;
  const task = payload.tasks?.[0];
  if (payload.status_code !== 20000 || !task) throw new Error(payload.status_message ?? "DataForSEO local search failed.");
  if (isValidLocalNoResultsTask(task)) return { items: [], taskId: task.id ?? task.task_id ?? null, resultDepth: 20 };
  if (task.status_code !== 20000) throw new Error(task.status_message ?? "DataForSEO local search failed.");
  return { items: (task.result?.[0]?.items ?? []).filter((item) => item.type === "local_pack"), taskId: task.id ?? task.task_id ?? null, resultDepth: 20 };
}
