import {
  formatConfidenceLabel,
  formatCoverageShort,
  getScoreConfidence,
} from "@/lib/audit/presentation/health-score";
import { formatScoreCoverageLabel } from "@/lib/audit/history/compare";
import { presentCustomerRecommendation } from "@/lib/audit/presentation/customer";
import { formatLocationName, formatSearchDemand, formatSearchQuery } from "@/lib/audit/presentation/location";
import type { PublicAuditDetail } from "@/lib/audit/public/types";
import { wrapSowForPrintDocument } from "@/lib/legal/sow-print";
import { selectOpportunityResults } from "@/lib/audit/search-visibility/run";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function demandText(level: string | undefined, volume: number | null | undefined): string {
  return escapeHtml(formatSearchDemand(level, volume));
}

export function reportOpportunityResults(results: NonNullable<PublicAuditDetail["searchVisibility"]>["results"]) {
  return selectOpportunityResults(results, 3);
}

export function searchVisibilityFailureMessage(visibility: NonNullable<PublicAuditDetail["searchVisibility"]>) {
  return visibility.diagnostics?.failureCode === "insufficient_discovery_coverage"
    ? "We couldn't identify enough reliable customer search queries from the website to measure Google Search Visibility for this report."
    : "Search Visibility could not be measured during this report.";
}

export function discoveryMeasurementCopy(results: NonNullable<PublicAuditDetail["searchVisibility"]>["results"]) {
  const discovery = results.filter((result) => result.type === "discovery");
  const attempted = discovery.length;
  const measured = discovery.filter((result) => result.collectionStatus !== "failed").length;
  const failed = attempted - measured;
  return failed > 0
    ? `We successfully measured ${measured} of ${attempted} non-branded customer ${attempted === 1 ? "search" : "searches"}. ${failed} additional ${failed === 1 ? "search could" : "searches could"} not be measured and ${failed === 1 ? "was" : "were"} excluded from the score.`
    : `We checked ${measured} non-branded discovery ${measured === 1 ? "search" : "searches"} potential customers may use when looking for the services you offer.`;
}

const CATEGORY_LABELS: Record<string, string> = {
  accessibility: "Accessibility",
  aeo: "AI & Answer Readiness",
  conversion: "Conversion Readiness",
  performance: "Speed & Performance",
  security: "Security",
  seo: "SEO Setup",
  technical: "Website Technology",
};

function categoryLabel(category: string) {
  return CATEGORY_LABELS[category.toLowerCase()] ?? category;
}

function statusForScore(score: number | null) {
  if (score == null) return "Not measured yet";
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Needs improvement";
  return "Poor";
}

export function localSearchInterpretation(summary: { foundCount: number; queriesAnalyzed: number; topThreeCount: number }) {
  const total = Math.max(0, summary.queriesAnalyzed);
  const found = Math.max(0, summary.foundCount);
  const topThree = Math.max(0, summary.topThreeCount);
  if (total === 0 || found === 0) return "Your business was not found in Google’s local results for the searches checked.";
  if (topThree >= 2 && found >= Math.ceil(total * 0.6)) return "Your business has strong local visibility, appearing prominently in several of the local searches checked.";
  if (topThree === 0 && found >= Math.ceil(total * 0.6)) return "Your business is appearing in Google’s local results, but not yet prominently. None of the searches checked placed the business in the top 3 local results.";
  if (topThree > 0 && found < total) return "Your business appears prominently for some searches, but local visibility varies by search.";
  if (found < total) return "Your business appears in some of Google’s local results, but local visibility is inconsistent across the searches checked.";
  return "Your business appears in Google’s local results for the searches checked, with room to improve prominence.";
}

export function searchDemandRecommendation(
  recommendation: { category: string; title: string; description: string },
  results: NonNullable<PublicAuditDetail["searchVisibility"]>["results"],
) {
  if (recommendation.category === "local_seo") return null;
  const lower = `${recommendation.category} ${recommendation.title} ${recommendation.description}`.toLowerCase();
  const relevant = lower.includes("seo") || lower.includes("google") || lower.includes("business") || lower.includes("service") || lower.includes("question") || lower.includes("faq");
  if (!relevant) return null;
  const candidate = results.filter((result) => result.type === "discovery" && result.collectionStatus !== "failed" && result.monthlySearchVolume != null && result.monthlySearchVolume > 0 && (result.position == null || result.position > 10)).sort((a, b) => {
    const aTier = a.relevanceTier ?? 99;
    const bTier = b.relevanceTier ?? 99;
    if (aTier !== bTier) return aTier - bTier;
    return (b.monthlySearchVolume ?? 0) - (a.monthlySearchVolume ?? 0);
  })[0];
  if (!candidate) return null;
  const market = formatLocationName(candidate.resolvedLocationName ?? candidate.location)?.replace(/, United States$/, "") ?? "the selected market";
  const displayedQuery = formatSearchQuery(candidate.query, candidate.resolvedLocationName ?? candidate.location);
  const keyword = displayedQuery.split(" — ")[0] ?? candidate.query;
  const volume = candidate.monthlySearchVolume!.toLocaleString();
  if (candidate.position == null) return { customerTitle: "Improve visibility in Google search results", customerDescription: `Your site was not found in the top 30 Google search results for “${keyword},” despite measurable local search demand of about ${volume} searches per month around ${market}. Strengthen service and location signals around the services customers are actively searching for.` };
  if (candidate.position > 10) return { customerTitle: "Strengthen an existing search position", customerDescription: `You already rank #${candidate.position} for “${keyword},” a term with about ${volume} searches per month around ${market}. Improving this page could help turn an existing position into stronger visibility.` };
  return null;
}

function reportRecommendations(detail: PublicAuditDetail) {
  const demandEvidence = detail.searchVisibility?.status === "completed"
    ? searchDemandRecommendation({ category: "seo", title: "Help Google understand your business", description: "Improve visibility for the services customers are searching for." }, detail.searchVisibility.results)
    : null;
  const demandRecommendation = demandEvidence ? {
    title: demandEvidence.customerTitle,
    description: demandEvidence.customerDescription,
    priority: "high",
    impact: "High business impact",
    effort: "Review and improve",
    category: "search_visibility",
    recommendationKey: "search.demand_visibility",
    signalworksServiceKey: null,
  } : null;
  return demandRecommendation ? [demandRecommendation, ...detail.recommendations] : detail.recommendations;
}

function plainSummary(detail: PublicAuditDetail) {
  const discovery = detail.searchVisibility?.summary?.discoveryScore;
  const localizedDemand = detail.searchVisibility?.results.some((result) => result.type === "discovery" && result.monthlySearchVolume != null && result.demandLevel !== "unavailable");
  const market = formatLocationName(detail.searchVisibility?.locationName)?.replace(/, United States$/, "");
  const local = detail.localSearch?.summary;
  const localWeak = local && local.queriesAnalyzed > 0 && local.foundCount / local.queriesAnalyzed <= 0.2;
  if ((discovery != null && discovery <= 40) || localWeak) {
    const brandedStrong = (detail.searchVisibility?.summary?.brandedScore ?? 0) >= 75;
    const demandContext = localizedDemand ? ` We found measurable local search demand around ${market ?? "the selected market"}, which makes these visibility gaps especially important.` : "";
    return `Your website has a solid technical foundation, but that isn't translating into strong search visibility. ${brandedStrong ? "People searching specifically for your business can find you easily, but " : ""}the site has limited visibility when new customers search for the services you provide${localWeak ? ", and the business was rarely found in the local results we checked" : ""}.${demandContext}`;
  }
  if ((detail.aeoReadiness?.score ?? 100) < 40) return "Your website has a workable foundation, but important business information and customer answers could be structured more clearly for search engines and answer-oriented systems. Strong technical SEO alone does not guarantee visibility or useful answers.";
  const sorted = [...detail.scores].sort((a, b) => a.score - b.score);
  const weakest = sorted[0] ? categoryLabel(sorted[0].category).toLowerCase() : "your website";
  const strongest = sorted.at(-1) ? categoryLabel(sorted.at(-1)!.category).toLowerCase() : "your website";
  return `Your website has a strong foundation, especially in ${strongest}. The biggest opportunity is improving ${weakest} so visitors and search engines can understand and use your business more easily.`;
}

export function executiveHeadline(detail: PublicAuditDetail) {
  const foundationStrong = detail.overallScore != null && detail.overallScore >= 75;
  const searchUnavailable = detail.searchVisibility?.status !== "completed";
  const searchPoor = detail.searchVisibility?.status === "completed" && (detail.searchVisibility.score ?? 100) <= 40;
  const localUnavailable = detail.localSearch?.status !== "completed";
  const localPoor = detail.localSearch?.status === "completed" && detail.localSearch.summary != null && detail.localSearch.summary.queriesAnalyzed > 0 && detail.localSearch.summary.foundCount / detail.localSearch.summary.queriesAnalyzed <= 0.2;
  if (searchUnavailable || localUnavailable) return "Your website foundation is measured, but some customer visibility results are not available.";
  if (foundationStrong && (searchPoor || localPoor)) return "Your website is built well — but new customers aren't finding it.";
  if (foundationStrong && !searchPoor && !localPoor) return "Your website is built well — and customers can find you.";
  if (!foundationStrong && (searchPoor || localPoor)) return "Your website needs stronger foundations and better customer visibility.";
  return "Your website is building a foundation for customer visibility.";
}

export function buildPublicAuditReportHtml(detail: PublicAuditDetail): string {
  const scoring = detail.progress.scoring;
  const scoredCount = scoring?.scoredCategoryCount;
  const eligibleCount = scoring?.eligibleCategoryCount;
  const coverage =
    scoredCount != null && eligibleCount != null
      ? formatScoreCoverageLabel(scoredCount, eligibleCount)
      : null;
  const confidence =
    scoredCount != null ? formatConfidenceLabel(getScoreConfidence(scoredCount)) : null;
  const discoveryCount = detail.searchVisibility?.summary?.discoveryQueriesAnalyzed ?? 0;
  const brandedCount = detail.searchVisibility?.summary?.brandedQueriesAnalyzed ?? 0;
  const discoveryResults = detail.searchVisibility?.results.filter((result) => result.type === "discovery") ?? [];
  const brandedResults = detail.searchVisibility?.results.filter((result) => result.type === "branded") ?? [];
  const confirmedNotFoundCount = discoveryResults.filter((result) => result.collectionStatus !== "failed" && (result.position == null || result.position > 30)).length;
  const discoveryMeasurementCopyText = discoveryMeasurementCopy(discoveryResults);
  let searchDemandCopyUsed = false;
  const localInterpretation = detail.localSearch?.status === "completed" && detail.localSearch.summary
    ? localSearchInterpretation(detail.localSearch.summary)
    : null;
  const searchVisibilityFailureCopy = detail.searchVisibility
    ? searchVisibilityFailureMessage(detail.searchVisibility)
    : "Search Visibility could not be measured during this report.";
  const body = `
    <article style="max-width: 820px; margin: 0 auto; font-family: Arial, sans-serif; color: #121212;">
      <header style="margin-bottom: 3rem; border-bottom: 1px solid #e2e0da; padding-bottom: 2rem;">
        <p style="text-transform: uppercase; letter-spacing: 0.16em; font-size: 11px; color: #666;">Website visibility report</p>
        <h1 style="margin: 0.5rem 0 0; font-size: 42px; font-weight: 500;">${escapeHtml(detail.businessName ?? detail.normalizedDomain)}</h1>
        <p style="color: #666; margin-top: 0.75rem;">${escapeHtml(detail.normalizedUrl)}</p>
        <p style="color: #666; margin-top: 1rem; line-height: 1.6;">We analyzed your website, search readiness, performance, and customer experience to identify what&apos;s working and where you have opportunities to improve.</p>
      </header>

      <section style="margin-bottom: 3rem;">
        <p style="text-transform: uppercase; letter-spacing: 0.16em; font-size: 11px; color: #666;">Executive summary</p>
        <h2 style="font-size: 28px; font-weight: 500;">Is your website healthy?</h2>
        <p style="font-size: 22px; line-height: 1.4; margin-top: 1.5rem;"><strong>${escapeHtml(executiveHeadline(detail))}</strong></p>
        <div style="background: #121212; color: white; border-radius: 12px; padding: 2rem; margin-top: 1rem;">
          <p style="text-transform: uppercase; letter-spacing: 0.14em; font-size: 11px; color: #aaa;">Website health</p>
          <p style="font-size: 64px; line-height: 1; margin: 1.5rem 0 0.75rem;">${detail.overallScore == null ? "—" : Math.round(detail.overallScore)} <span style="font-size: 14px; color: #aaa;">/ 100</span></p>
          <p style="font-weight: 600;">${statusForScore(detail.overallScore)}</p>
          <p style="color: #ccc; line-height: 1.6;">${escapeHtml(detail.summary ?? "Your website has a strong foundation, with several opportunities to improve performance and search visibility.")}</p>
        </div>
        <p style="font-size: 18px; line-height: 1.7; margin-top: 2rem;"><strong>What this means:</strong> ${escapeHtml(plainSummary(detail))}</p>
      </section>

      <section style="margin-bottom: 3rem;">
        <p style="text-transform: uppercase; letter-spacing: 0.16em; font-size: 11px; color: #666;">Your website health</p>
        <h2 style="font-size: 28px; font-weight: 500;">Built for visitors, search engines, and AI</h2>
        <div style="display: grid; gap: 12px;">
          ${detail.scores.map((row) => `<div style="border: 1px solid #e2e0da; border-radius: 10px; padding: 1rem 1.25rem;"><div style="display: flex; justify-content: space-between; gap: 1rem;"><div><strong>${escapeHtml(categoryLabel(row.category))}</strong></div><div style="text-align: right;"><strong style="font-size: 24px;">${Math.round(row.score)}</strong><p style="margin: 0.25rem 0 0; font-size: 12px; color: #666;">${statusForScore(row.score)}</p></div></div><div style="height: 6px; background: #f1f0ec; border-radius: 6px; margin-top: 1rem;"><div style="height: 6px; width: ${Math.max(0, Math.min(100, row.score))}%; background: #121212; border-radius: 6px;"></div></div></div>`).join("")}
        </div>
      </section>

      <section style="margin-bottom: 3rem;">
        <p style="text-transform: uppercase; letter-spacing: 0.16em; font-size: 11px; color: #666;">Your biggest opportunities</p>
        <h2 style="font-size: 28px; font-weight: 500;">Improvements worth prioritizing</h2>
        ${reportRecommendations(detail).slice(0, 5).map((rec, index) => { const presentation = presentCustomerRecommendation(rec); const evidenceCopy = !searchDemandCopyUsed && detail.searchVisibility?.status === "completed" ? searchDemandRecommendation(rec, detail.searchVisibility.results) : null; if (evidenceCopy) searchDemandCopyUsed = true; const displayed = evidenceCopy ? { ...presentation, ...evidenceCopy } : presentation; return `<div style="border-bottom: 1px solid #e2e0da; padding: 1rem 0;"><div style="display: flex; gap: 1rem;"><strong style="font-size: 22px; color: #666;">${index + 1}</strong><div><strong>${escapeHtml(displayed.customerTitle)}</strong><p style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.05em;">${escapeHtml(rec.priority)} priority · ${escapeHtml(rec.impact ?? "Impact varies")} · ${escapeHtml(rec.effort ?? "Review effort")}</p><p style="color: #555; line-height: 1.6;">${escapeHtml(displayed.customerDescription)}</p><p style="font-size: 12px; color: #666;">Category: ${escapeHtml(displayed.customerCategory)}</p><p style="font-size: 12px; color: #666;">Technical details: ${escapeHtml(displayed.technicalTitle)}${displayed.technicalValue ? ` · ${escapeHtml(displayed.technicalValue)}` : ""}</p></div></div></div>`; }).join("") || `<p style="color: #666;">No recommendations were recorded for this report.</p>`}
      </section>

      <section style="margin-bottom: 3rem; border: 1px solid #e2e0da; border-radius: 12px; padding: 1.5rem;">
        <p style="text-transform: uppercase; letter-spacing: 0.16em; font-size: 11px; color: #666;">Search visibility</p>
        <h2 style="font-size: 24px; font-weight: 500;">Can customers find your business?</h2>
        ${detail.searchVisibility?.status === "completed" && detail.searchVisibility.summary ? `<p style="font-size: 32px; margin: 1rem 0 0;"><strong>${Math.round(detail.searchVisibility.score ?? 0)}/100</strong></p><p style="color: #555; line-height: 1.6;">We checked ${discoveryCount} non-branded discovery ${discoveryCount === 1 ? "search" : "searches"} potential customers may use when looking for the services you offer. We also checked ${brandedCount} branded ${brandedCount === 1 ? "search" : "searches"} for the business name, shown separately below. ${detail.searchVisibility.summary.firstPageCount} produced a first-page ranking and ${confirmedNotFoundCount} successfully checked searches were not found in the top 30.</p><h3 style="font-size: 20px;">Top search opportunities</h3><p style="color: #555; line-height: 1.6;">Search opportunities combine estimated local search demand with current Google visibility. High-demand searches where your business has little or no visibility are prioritized first.</p>${reportOpportunityResults(detail.searchVisibility.results).map((result, index) => { const ranking = result.position ? `#${result.position}` : "Not in top 30"; const interpretation = result.monthlySearchVolume == null || result.demandLevel === "unavailable" ? "" : result.position == null ? "This is a meaningful customer search, but the website was not visible in the top 30 results we checked." : result.position > 10 ? "The website is visible, but moving closer to the first page could make this opportunity more valuable." : "The website is already visible for this search, so maintaining and improving this position could protect its value."; return `<p style="border-bottom: 1px solid #eee; padding: 8px 0;"><strong>${index + 1}. ${escapeHtml(formatSearchQuery(result.query, result.resolvedLocationName ?? result.location))}</strong>${index === 0 ? ` <span style="font-size: 11px; color: #666; text-transform: uppercase;">Biggest search opportunity</span>` : ""}<br><span style="color: #555;">${escapeHtml(ranking)}${result.monthlySearchVolume == null ? "" : ` · ${demandText(result.demandLevel, result.monthlySearchVolume)} · ${escapeHtml(result.opportunityLabel ?? "Opportunity")}`}${interpretation ? ` · ${escapeHtml(interpretation)}` : ""}</span></p>`; }).join("")}<h3 style="font-size: 20px;">Discovery visibility</h3><p style="color: #555;">What are customers searching for — and where do you appear?</p><table style="width: 100%; border-collapse: collapse; margin-top: 1rem;"><thead><tr><th style="text-align: left; border-bottom: 1px solid #ddd; padding: 8px 0;">Customer search</th><th style="text-align: left; border-bottom: 1px solid #ddd; padding: 8px 0;">Google position</th><th style="text-align: left; border-bottom: 1px solid #ddd; padding: 8px 0;">Search demand <span title="Estimated monthly Google searches for this term in the selected market.">ⓘ</span></th><th style="text-align: left; border-bottom: 1px solid #ddd; padding: 8px 0;">Evidence</th></tr></thead><tbody>${discoveryResults.map((result) => `<tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(formatSearchQuery(result.query, result.resolvedLocationName ?? result.location))}</td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${result.collectionStatus === "failed" ? "Unable to measure" : result.position ? `#${result.position}` : "Not in top 30"}</td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${demandText(result.demandLevel, result.monthlySearchVolume)}</td><td style="padding: 8px 0; border-bottom: 1px solid #eee; font-size: 12px; color: #555;">${formatLocationName(result.resolvedLocationName ?? result.location) ? `${escapeHtml(formatLocationName(result.resolvedLocationName ?? result.location)!)}` : "Location not recorded"} · ${escapeHtml(result.checkedAt)} · Top ${result.resultDepth ?? 30} · ${result.collectionStatus === "failed" ? "Unable to measure" : result.position != null ? `#${result.position}` : "Not found"}${result.rankingUrl ? ` · ${escapeHtml(result.rankingUrl)}` : ""}</td></tr>`).join("")}</tbody></table>` : `<p style="color: #555; line-height: 1.6;">Search visibility could not be measured for this report. SEO Setup checks show whether your website is prepared for search, but we do not claim Google rankings without verified search data.</p>`}
      </section>

      <section style="margin-bottom: 3rem; border: 1px solid #e2e0da; border-radius: 12px; padding: 1.5rem;">
        <p style="text-transform: uppercase; letter-spacing: 0.16em; font-size: 11px; color: #666;">Google Maps &amp; Local Search</p>
        <h2 style="font-size: 24px; font-weight: 500;">Can nearby customers find your business?</h2>
        ${detail.localSearch?.status === "not_applicable" ? `<p style="color: #555;">Google Maps &amp; Local Search: Not applicable.</p>` : detail.localSearch?.status === "completed" && detail.localSearch.summary ? `<p style="font-size: 32px; margin: 1rem 0 0;"><strong>${Math.round(detail.localSearch.score ?? 0)}/100</strong></p><p style="color: #555; line-height: 1.6;">Google can show your business in two different ways: regular website search results and local business results connected with Google Maps. This section measures your visibility in those local results separately. ${detail.localSearch.summary.foundCount} of ${detail.localSearch.summary.queriesAnalyzed} searches found the business, and ${detail.localSearch.summary.topThreeCount} ranked in the top three.</p><p style="color: #555; line-height: 1.6;">${localInterpretation ? escapeHtml(localInterpretation) : ""}</p><table style="width: 100%; border-collapse: collapse; margin-top: 1rem;"><thead><tr><th style="text-align: left; border-bottom: 1px solid #ddd; padding: 8px 0;">Customer search</th><th style="text-align: left; border-bottom: 1px solid #ddd; padding: 8px 0;">Google local position</th><th style="text-align: left; border-bottom: 1px solid #ddd; padding: 8px 0;">How we checked</th></tr></thead><tbody>${detail.localSearch.results.map((result) => `<tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(formatSearchQuery(result.query, result.resolvedLocationName ?? result.location))}</td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${result.position ? `#${result.position}` : "Not found"}</td><td style="padding: 8px 0; border-bottom: 1px solid #eee; font-size: 12px; color: #555;">${escapeHtml(formatLocationName(result.resolvedLocationName ?? result.location) ?? "Location not recorded")} · ${escapeHtml(result.checkedAt)} · Top ${result.resultDepth ?? 20} · ${result.position != null ? `#${result.position}` : "Not found"}${result.resultUrl ? ` · ${escapeHtml(result.resultUrl)}` : ""}</td></tr>`).join("")}</tbody></table>` : detail.localSearch?.status === "failed" ? `<p style="color: #555;">Google Maps &amp; Local Search could not be measured during this report.</p>` : `<p style="color: #555;">Google Maps &amp; Local Search could not be measured for this report.</p>`}
      </section>

      ${detail.searchVisibility?.status === "completed" && detail.searchVisibility.summary ? `<section style="margin-bottom: 3rem; border: 1px solid #e2e0da; border-radius: 12px; padding: 1.5rem;"><p style="text-transform: uppercase; letter-spacing: 0.16em; font-size: 11px; color: #666;">Branded search</p><h2 style="font-size: 22px; font-weight: 500;">${detail.searchVisibility.summary.brandedScore != null && detail.searchVisibility.summary.brandedScore < 75 ? "Can people who already know your business find you?" : "Branded search looks healthy"}</h2><p style="color: #555; line-height: 1.6;">Branded searches are shown separately from searches new customers may use. Branded score: ${detail.searchVisibility.summary.brandedScore == null ? "—" : `${Math.round(detail.searchVisibility.summary.brandedScore)}/100`}</p><table style="width: 100%; border-collapse: collapse; margin-top: 1rem;"><thead><tr><th style="text-align: left; border-bottom: 1px solid #ddd; padding: 8px 0;">Customer search</th><th style="text-align: left; border-bottom: 1px solid #ddd; padding: 8px 0;">Google position</th><th style="text-align: left; border-bottom: 1px solid #ddd; padding: 8px 0;">Evidence</th></tr></thead><tbody>${brandedResults.map((result) => `<tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(formatSearchQuery(result.query, result.resolvedLocationName ?? result.location))}</td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${result.position ? `#${result.position}` : "Not in top 30"}</td><td style="padding: 8px 0; border-bottom: 1px solid #eee; font-size: 12px; color: #555;">${escapeHtml(formatLocationName(result.resolvedLocationName ?? result.location) ?? "Location not recorded")} · ${escapeHtml(result.checkedAt)} · Top ${result.resultDepth ?? 30}</td></tr>`).join("")}</tbody></table></section>` : ""}

      ${detail.aeoReadiness ? `<section style="margin-bottom: 3rem; border: 1px solid #e2e0da; border-radius: 12px; padding: 1.5rem;"><p style="text-transform: uppercase; letter-spacing: 0.16em; font-size: 11px; color: #666;">AI &amp; answer readiness</p><h2 style="font-size: 24px; font-weight: 500;">Can search engines and AI systems understand your business?</h2><p style="font-size: 32px; margin: 1rem 0 0;"><strong>${Math.round(detail.aeoReadiness.score)}/100</strong></p><p style="color: #555; line-height: 1.6;">Answered clearly: ${detail.aeoReadiness.questionCoverage.answered} of ${detail.aeoReadiness.questionCoverage.total} common customer questions. This measures website readiness, not AI recommendations or rankings.</p><h3 style="font-size: 18px;">Readiness categories</h3><ul>${detail.aeoReadiness.categories.slice(0, 6).map((category) => `<li>${escapeHtml(category.label)}: ${category.score}</li>`).join("")}</ul><h3 style="font-size: 18px;">Top opportunities</h3><ul>${detail.aeoReadiness.recommendations.slice(0, 3).map((item) => `<li>${escapeHtml(item.title)} — ${escapeHtml(item.description)}</li>`).join("")}</ul></section>` : ""}

      <section style="font-size: 13px; color: #666;"><p><strong>Report details:</strong> Last checked ${escapeHtml(detail.completedAt ?? detail.createdAt)}${coverage ? ` · ${escapeHtml(formatCoverageShort(scoredCount!, eligibleCount!))}` : ""}${confidence ? ` · Confidence: ${escapeHtml(confidence)}` : ""}</p><p>This is not a penetration test or accessibility certification. Unavailable categories are excluded from the overall score.</p></section>
    </article>
  `;

  const printableBody = body
    .replace(
      `We checked ${discoveryCount} non-branded discovery ${discoveryCount === 1 ? "search" : "searches"} potential customers may use when looking for the services you offer.`,
      discoveryMeasurementCopyText,
    )
    .replace("Search visibility could not be measured for this report.", searchVisibilityFailureCopy);

  return wrapSowForPrintDocument(
    printableBody,
    `Website Health Score — ${detail.businessName ?? detail.normalizedDomain}`,
  );
}
