export type PageSpeedMetricSet = {
  score: number | null;
  lcpMs: number | null;
  cls: number | null;
  inpMs: number | null;
  tbtMs: number | null;
  fieldDataAvailable: boolean;
};

export type PageSpeedAnalysisResult = {
  mobile: PageSpeedMetricSet;
  desktop: PageSpeedMetricSet;
  opportunities: Array<{ id: string; title: string }>;
  rawAvailable: boolean;
};

export type PageSpeedClient = {
  isConfigured(): boolean;
  analyze(url: string): Promise<PageSpeedAnalysisResult | null>;
};

export function createPageSpeedClient(apiKey = process.env.GOOGLE_PAGESPEED_API_KEY): PageSpeedClient {
  const key = apiKey?.trim();

  return {
    isConfigured() {
      return Boolean(key);
    },

    async analyze(url: string) {
      if (!key) return null;

      const [mobile, desktop] = await Promise.all([
        fetchPageSpeedStrategy(url, key, "mobile"),
        fetchPageSpeedStrategy(url, key, "desktop"),
      ]);

      if (!mobile && !desktop) return null;

      return {
        mobile: mobile ?? emptyMetrics(),
        desktop: desktop ?? emptyMetrics(),
        opportunities: [
          ...(mobile?.opportunities ?? []),
          ...(desktop?.opportunities ?? []),
        ].slice(0, 8),
        rawAvailable: true,
      };
    },
  };
}

export function createMockPageSpeedClient(
  fixture?: Partial<PageSpeedAnalysisResult>,
): PageSpeedClient {
  const result: PageSpeedAnalysisResult = {
    mobile: fixture?.mobile ?? {
      score: 72,
      lcpMs: 3200,
      cls: 0.08,
      inpMs: 180,
      tbtMs: 250,
      fieldDataAvailable: false,
    },
    desktop: fixture?.desktop ?? {
      score: 88,
      lcpMs: 1800,
      cls: 0.04,
      inpMs: 90,
      tbtMs: 120,
      fieldDataAvailable: false,
    },
    opportunities: fixture?.opportunities ?? [
      { id: "render-blocking", title: "Reduce render-blocking resources" },
    ],
    rawAvailable: fixture?.rawAvailable ?? true,
  };

  return {
    isConfigured: () => true,
    analyze: async () => result,
  };
}

type StrategyResult = PageSpeedMetricSet & {
  opportunities: Array<{ id: string; title: string }>;
};

async function fetchPageSpeedStrategy(
  url: string,
  apiKey: string,
  strategy: "mobile" | "desktop",
): Promise<StrategyResult | null> {
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", strategy);
  endpoint.searchParams.set("category", "performance");
  endpoint.searchParams.set("key", apiKey);

  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(55_000),
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    lighthouseResult?: {
      categories?: { performance?: { score?: number | null } };
      audits?: Record<
        string,
        { score?: number | null; numericValue?: number; title?: string; scoreDisplayMode?: string }
      >;
    };
    loadingExperience?: { metrics?: Record<string, unknown> };
    originLoadingExperience?: { metrics?: Record<string, unknown> };
  };

  const lighthouse = payload.lighthouseResult;
  if (!lighthouse) return null;

  const audits = lighthouse.audits ?? {};
  const performanceScore = lighthouse.categories?.performance?.score;
  const fieldDataAvailable = Boolean(
    payload.loadingExperience?.metrics ?? payload.originLoadingExperience?.metrics,
  );

  const opportunities = Object.entries(audits)
    .filter(([, audit]) => audit.scoreDisplayMode === "metricSavings" && (audit.score ?? 1) < 0.9)
    .slice(0, 5)
    .map(([id, audit]) => ({
      id,
      title: audit.title ?? id,
    }));

  return {
    score: performanceScore == null ? null : Math.round(performanceScore * 100),
    lcpMs: audits["largest-contentful-paint"]?.numericValue ?? null,
    cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
    inpMs: audits["interaction-to-next-paint"]?.numericValue ?? null,
    tbtMs: audits["total-blocking-time"]?.numericValue ?? null,
    fieldDataAvailable,
    opportunities,
  };
}

function emptyMetrics(): PageSpeedMetricSet {
  return {
    score: null,
    lcpMs: null,
    cls: null,
    inpMs: null,
    tbtMs: null,
    fieldDataAvailable: false,
  };
}
