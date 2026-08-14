import type { KeywordIdea } from "./types";

type GoogleAdsKeywordRow = {
  keyword?: string;
  search_volume?: number | null;
  cpc?: number | null;
  competition?: string | number | null;
  competition_index?: number | null;
  location_code?: number | null;
  monthly_searches?: Array<{ year?: number; month?: number; search_volume?: number | null }>;
  keyword_annotations?: { concepts?: Array<{ name?: string; concept_group?: { name?: string; type?: string | null } }> };
};

type GoogleAdsTaskResponse = {
  status_code?: number;
  status_message?: string;
  tasks?: Array<{
    status_code?: number;
    status_message?: string;
    result_count?: number;
    result?: GoogleAdsKeywordRow[];
  }>;
};

export type GoogleAdsKeywordRequestResult = {
  ideas: KeywordIdea[];
  httpStatus: number;
  taskStatus: number | null;
  resultCount: number;
};

function isBrandIdea(row: GoogleAdsKeywordRow): boolean {
  return (row.keyword_annotations?.concepts ?? []).some((concept) => {
    const type = concept.concept_group?.type?.toUpperCase();
    const group = concept.concept_group?.name?.toUpperCase();
    const name = concept.name?.toUpperCase();
    return type === "BRAND" || group === "BRAND" || group === "BRANDS" || name === "BRAND";
  });
}

function toIdea(row: GoogleAdsKeywordRow): KeywordIdea | null {
  const keyword = row.keyword?.trim();
  if (!keyword) return null;
  return {
    keyword,
    searchVolume: row.search_volume ?? null,
    cpc: row.cpc ?? null,
    competition: typeof row.competition === "number" ? row.competition : null,
    competitionIndex: row.competition_index ?? null,
    monthlySearches: row.monthly_searches
      ?.filter((item): item is { year: number; month: number; search_volume: number | null } => item.year != null && item.month != null)
      .map((item) => ({ year: item.year, month: item.month, search_volume: item.search_volume ?? null })),
    isBrand: isBrandIdea(row),
  };
}

async function postGoogleAdsKeywords(input: { path: string; body: unknown; timeoutMs?: number }): Promise<GoogleAdsKeywordRequestResult> {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) throw new Error("DataForSEO credentials are not configured.");

  const response = await fetch(`https://api.dataforseo.com/v3/${input.path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input.body),
    signal: AbortSignal.timeout(input.timeoutMs ?? 45_000),
  });
  if (!response.ok) throw Object.assign(new Error(`DataForSEO HTTP ${response.status}`), { httpStatus: response.status });
  const payload = (await response.json()) as GoogleAdsTaskResponse;
  const task = payload.tasks?.[0];
  if (payload.status_code !== 20000 || !task || task.status_code !== 20000) {
    throw Object.assign(new Error(task?.status_message ?? payload.status_message ?? "DataForSEO keyword discovery failed."), {
      httpStatus: response.status,
      taskStatus: task?.status_code ?? payload.status_code ?? null,
    });
  }
  const rows = task.result ?? [];
  return {
    ideas: rows.map(toIdea).filter((idea): idea is KeywordIdea => Boolean(idea)),
    httpStatus: response.status,
    taskStatus: task.status_code ?? null,
    resultCount: task.result_count ?? rows.length,
  };
}

export async function fetchKeywordsForSite(input: { target: string; locationCode: number; languageCode?: string }): Promise<GoogleAdsKeywordRequestResult> {
  return postGoogleAdsKeywords({
    path: "keywords_data/google_ads/keywords_for_site/live",
    body: [{
      target: input.target,
      target_type: "site",
      location_code: input.locationCode,
      language_code: input.languageCode ?? "en",
      search_partners: false,
      sort_by: "relevance",
    }],
  });
}

export async function fetchKeywordsForKeywords(input: { keywords: string[]; locationCode: number; languageCode?: string }): Promise<GoogleAdsKeywordRequestResult> {
  const keywords = [...new Set(input.keywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
  if (!keywords.length) return { ideas: [], httpStatus: 0, taskStatus: null, resultCount: 0 };
  return postGoogleAdsKeywords({
    path: "keywords_data/google_ads/keywords_for_keywords/live",
    body: [{
      keywords,
      location_code: input.locationCode,
      language_code: input.languageCode ?? "en",
      search_partners: false,
      sort_by: "relevance",
    }],
  });
}
