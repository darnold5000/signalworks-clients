"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, ButtonLink, MetaRow, Panel, StatusPill } from "@/components/ui";
import {
  AUDIT_STATUS_LABELS,
  RECOMMENDATION_STATUS_OPTIONS,
  auditStatusTone,
  formatScoreChange,
} from "@/lib/audit/admin/labels";
import type { AuditRunDetail } from "@/lib/audit/admin/types";
import {
  formatConfidenceLabel,
  formatScoreCoverageLabel,
  getScoreConfidence,
} from "@/lib/audit/history/compare";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const TABS = [
  "summary",
  "scores",
  "findings",
  "recommendations",
  "history",
  "report",
  "notes",
] as const;

type TabId = (typeof TABS)[number];

const CATEGORY_PRESENTATION: Record<string, { label: string; description: string }> = {
  accessibility: {
    label: "Accessibility",
    description: "How easily people with different needs can use your website.",
  },
  aeo: {
    label: "AI & Answer Readiness",
    description: "How clearly search engines and AI systems can understand your business.",
  },
  conversion: {
    label: "Conversion Readiness",
    description: "How well your website helps visitors take the next step.",
  },
  performance: {
    label: "Speed & Performance",
    description: "How quickly and smoothly your website loads for visitors.",
  },
  security: { label: "Security", description: "The safeguards that help keep your website and visitors protected." },
  seo: { label: "SEO Setup", description: "Whether your website is technically prepared for search engines." },
  technical: { label: "Website Technology", description: "The underlying technology and reliability of your website." },
};

function scoreStatus(score: number | null) {
  if (score == null) return { label: "Not measured yet", tone: "neutral" as const };
  if (score >= 90) return { label: "Excellent", tone: "success" as const };
  if (score >= 75) return { label: "Good", tone: "success" as const };
  if (score >= 60) return { label: "Needs improvement", tone: "warning" as const };
  return { label: "Poor", tone: "danger" as const };
}

function categoryPresentation(category: string) {
  return CATEGORY_PRESENTATION[category.toLowerCase()] ?? {
    label: category,
    description: "A measured part of your website health.",
  };
}

function friendlyStrength(title: string) {
  const normalized = title.toLowerCase();
  if (normalized.includes("canonical")) return { title: "Search engines can identify your primary page", description: "Your website correctly tells search engines which page version should be indexed." };
  if (normalized.includes("h1") || normalized.includes("heading")) return { title: "Your page has a clear primary heading", description: "Your page structure makes it easier for visitors and search engines to understand the main topic." };
  if (normalized.includes("lang")) return { title: "Your website identifies its language correctly", description: "This helps browsers, search engines, and accessibility tools interpret your content." };
  if (normalized.includes("cls") || normalized.includes("stability")) return { title: "Excellent page stability", description: "Your website stays visually stable while loading, creating a smoother experience for visitors." };
  return { title, description: "This is a strong foundation for your website experience." };
}

function plainEnglishSummary(detail: AuditRunDetail) {
  const scored = [...detail.scores].sort((a, b) => a.score - b.score);
  const weakest = scored[0] ? categoryPresentation(scored[0].category).label.toLowerCase() : "your website";
  const strongest = scored.at(-1) ? categoryPresentation(scored.at(-1)!.category).label.toLowerCase() : "your website";
  return `Your website has a strong foundation, especially in ${strongest}. The biggest opportunity is improving ${weakest} so visitors and search engines can understand and use your business more easily.`;
}

function formatRecommendationDescription(description: string) {
  return description.replace(/(\d+(?:\.\d+)?)\s*ms\b/gi, (_, value: string) => `${(Number(value) / 1000).toFixed(1)} seconds`);
}

function visibilityBadges(finding: {
  isPublic: boolean;
  isClientVisible: boolean;
}) {
  const badges = [];
  if (finding.isPublic) badges.push("Marketing");
  if (finding.isClientVisible) badges.push("Client");
  if (!finding.isPublic && !finding.isClientVisible) badges.push("Internal");
  return badges;
}

export function AuditDetailClient({ detail }: { detail: AuditRunDetail }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("summary");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(null);
  const [updatingRecId, setUpdatingRecId] = useState<string | null>(null);

  const scoring = detail.progress.scoring;
  const coverageLabel =
    scoring?.eligibleCategoryCount != null && scoring?.scoredCategoryCount != null
      ? formatScoreCoverageLabel(
          scoring.scoredCategoryCount,
          scoring.eligibleCategoryCount,
        )
      : null;
  const confidenceLabel =
    scoring?.scoredCategoryCount != null
      ? formatConfidenceLabel(getScoreConfidence(scoring.scoredCategoryCount))
      : null;

  const collectorLabels = useMemo(
    () => Object.keys(detail.progress.collectors ?? {}).sort(),
    [detail.progress.collectors],
  );

  const filteredFindings = useMemo(() => {
    return detail.findings.filter((finding) => {
      if (categoryFilter && finding.category !== categoryFilter) return false;
      if (severityFilter && finding.severity !== severityFilter) return false;
      if (statusFilter && finding.status !== statusFilter) return false;
      return true;
    });
  }, [detail.findings, categoryFilter, severityFilter, statusFilter]);

  const categories = useMemo(
    () => [...new Set(detail.findings.map((f) => f.category))].sort(),
    [detail.findings],
  );

  async function updateRecommendationStatus(
    recommendationId: string,
    status: string,
  ) {
    setUpdatingRecId(recommendationId);
    try {
      const response = await fetch(
        `/api/admin/audits/${detail.runId}/recommendations/${recommendationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Update failed.");
      }
      router.refresh();
    } finally {
      setUpdatingRecId(null);
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-5 border-b border-border pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">Website visibility report</p>
          <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">
            {detail.businessName ?? detail.normalizedDomain}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            We analyzed your website, search readiness, performance, and customer experience to identify what&apos;s working and where you have opportunities to improve.
          </p>
          <p className="mt-3 text-sm text-muted">{detail.normalizedUrl}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill
            label={AUDIT_STATUS_LABELS[detail.status] ?? detail.status}
            tone={auditStatusTone(detail.status)}
          />
          <ButtonLink href="/admin/audits" variant="secondary">
            All audits
          </ButtonLink>
          {detail.tenantId ? (
            <ButtonLink
              href={`/admin/clients/${detail.tenantId}/audits`}
              variant="secondary"
            >
              Client history
            </ButtonLink>
          ) : null}
        </div>
      </div>

      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((tabId) => (
          <button
            key={tabId}
            type="button"
            onClick={() => setTab(tabId)}
            className={cn(
              "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition-colors",
              tab === tabId
                ? "border-foreground text-foreground"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {tabId}
          </button>
        ))}
      </nav>

      {tab === "summary" ? (
        <div className="space-y-10">
          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">Executive summary</p>
                <h2 className="mt-2 font-display text-3xl">Is your website healthy?</h2>
              </div>
              <details className="text-sm text-muted">
                <summary className="cursor-pointer font-medium text-foreground">Report details</summary>
                <p className="mt-2 rounded-lg border border-border bg-surface px-3 py-2">Last checked {formatDateTime(detail.completedAt ?? detail.createdAt)} · {coverageLabel ?? `${scoring?.scoredCategoryCount ?? detail.scores.length} categories analyzed`} · {confidenceLabel ?? "Not available"} confidence</p>
              </details>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
              <div className="rounded-xl border border-foreground bg-foreground p-6 text-white sm:p-8">
                <p className="text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">Website health</p>
                <div className="mt-5 flex items-end gap-3">
                  <span className="font-display text-7xl leading-none">{detail.overallScore == null ? "—" : Math.round(detail.overallScore)}</span>
                  <span className="pb-1 text-sm text-white/60">/ 100</span>
                </div>
                <p className="mt-4 text-sm font-medium text-white">{scoreStatus(detail.overallScore).label}</p>
                <p className="mt-2 max-w-lg text-sm leading-6 text-white/70">{detail.summary ?? "Your website has a strong foundation, with several opportunities to improve performance and search visibility."}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SummaryMetric label="Search visibility" value={null} />
                <SummaryMetric label="Local search" value={null} />
                <SummaryMetric label="AI readiness" value={detail.scores.find((row) => row.category === "aeo")?.score ?? null} />
                <SummaryMetric label="Conversion Readiness" value={detail.scores.find((row) => row.category === "conversion")?.score ?? null} />
              </div>
            </div>
          </section>

          <section className="max-w-3xl">
            <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">What this means</p>
            <p className="mt-3 text-lg leading-8">{plainEnglishSummary(detail)}</p>
          </section>

          <section>
            <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">Your website health</p>
            <h2 className="mt-2 font-display text-3xl">Built for visitors, search engines, and AI</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">These scores measure how well your website is built and prepared for visitors, search engines, and AI systems.</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {detail.scores.map((row) => <CategoryCard key={row.category} row={row} />)}
            </div>
          </section>

          <div className="grid gap-10 lg:grid-cols-2">
            <InsightSection title="What&apos;s working well" description="Your website already has several strong foundations.">
              {(scoring?.strengths ?? []).slice(0, 4).map((item) => {
                const friendly = friendlyStrength(item.title);
                return <div key={item.checkKey} className="border-b border-border py-4 first:pt-0 last:border-0"><p className="font-medium">✓ {friendly.title}</p><p className="mt-1 text-sm leading-6 text-muted">{friendly.description}</p><details className="mt-2 text-xs text-muted"><summary className="cursor-pointer">View technical details</summary><p className="mt-1 font-mono">{item.checkKey}</p></details></div>;
              })}
              {(scoring?.strengths ?? []).length === 0 ? <p className="text-sm text-muted">No strengths were recorded for this report.</p> : null}
            </InsightSection>

            <InsightSection title="Your biggest opportunities" description="These improvements are most likely to strengthen your website and online visibility.">
              {(detail.recommendations.length ? detail.recommendations : scoring?.opportunities ?? []).slice(0, 5).map((item, index) => {
                const recommendation = "description" in item ? item : { title: item.title, description: "This is an opportunity to improve your website experience.", priority: "medium", impact: null, effort: null, category: item.category };
                const category = "category" in recommendation && typeof recommendation.category === "string" ? recommendation.category : "technical";
                return <div key={"checkKey" in item ? item.checkKey : item.id} className="border-b border-border py-4 first:pt-0 last:border-0"><div className="flex gap-3"><span className="font-display text-2xl text-muted">{index + 1}</span><div><p className="font-medium">{recommendation.title}</p><p className="mt-1 text-xs font-semibold tracking-wide text-muted uppercase">{recommendation.priority} priority · {recommendation.impact ?? "Impact varies"} · {recommendation.effort ?? "Review effort"}</p><p className="mt-2 text-sm leading-6 text-muted">{formatRecommendationDescription(recommendation.description)}</p><p className="mt-2 text-xs text-muted">Category: {categoryPresentation(category).label}</p></div></div></div>;
              })}
              {detail.recommendations.length > 5 ? <button type="button" onClick={() => setTab("recommendations")} className="mt-4 text-sm font-medium text-accent hover:underline">View all recommendations →</button> : null}
              {detail.recommendations.length === 0 && !(scoring?.opportunities ?? []).length ? <p className="text-sm text-muted">No recommendations were recorded for this report.</p> : null}
            </InsightSection>
          </div>

          <section className="rounded-xl border border-border bg-surface p-6 sm:p-8">
            <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">Search visibility</p>
            <div className="mt-3 flex flex-wrap items-baseline justify-between gap-4"><h2 className="font-display text-3xl">Can customers find your business?</h2><StatusPill label="Not measured yet" /></div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Search visibility measures whether your website appears when customers search for the services you offer. This report includes SEO Setup checks, but does not yet include live ranking data.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2"><UnavailableMetric title="Branded visibility" text="Searches containing your business name" /><UnavailableMetric title="Discovery visibility" text="Searches for your services and location" /></div>
          </section>

          <details className="rounded-xl border border-border bg-surface p-5">
            <summary className="cursor-pointer font-medium">Technical details and data sources</summary>
            <div className="mt-4 grid gap-3 text-sm text-muted sm:grid-cols-2"><MetaRow label="Collectors" value={collectorLabels.join(", ") || "—"} /><MetaRow label="Scoring version" value={scoring?.scoringVersion ?? detail.engineVersion} /><MetaRow label="Scope version" value={detail.scopeVersion} /><MetaRow label="Unavailable categories" value={scoring?.unavailableCategories?.join(", ") || "None"} /></div>
          </details>
        </div>
      ) : null}

      {tab === "scores" ? (
        <Panel title="Category breakdown">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Score</th>
                  <th className="py-2 pr-4">Weight</th>
                  <th className="py-2">Findings</th>
                </tr>
              </thead>
              <tbody>
                {detail.scores.map((row) => (
                  <tr key={row.category} className="border-b border-border">
                    <td className="py-2 pr-4 capitalize">{row.category}</td>
                    <td className="py-2 pr-4 font-medium">{row.score}</td>
                    <td className="py-2 pr-4">{row.weight}</td>
                    <td className="py-2">{row.findingCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {tab === "findings" ? (
        <div className="space-y-4">
          <Panel title="Filters">
            <div className="grid gap-3 sm:grid-cols-3">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">All categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">All severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="info">Info</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">All statuses</option>
                <option value="pass">Pass</option>
                <option value="warning">Warning</option>
                <option value="fail">Fail</option>
                <option value="unavailable">Unavailable</option>
                <option value="manual_review">Manual review</option>
              </select>
            </div>
          </Panel>

          <Panel title={`${filteredFindings.length} findings`}>
            <ul className="space-y-4">
              {filteredFindings.map((finding) => (
                <li
                  key={finding.id}
                  className="rounded-md border border-border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{finding.title}</p>
                      <p className="text-xs text-muted">
                        {finding.category} · {finding.severity} · {finding.status} ·{" "}
                        {finding.sourceLabel}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {visibilityBadges(finding).map((badge) => (
                        <StatusPill key={badge} label={badge} tone="neutral" />
                      ))}
                    </div>
                  </div>
                  <p className="mt-2 text-sm">{finding.summary}</p>
                  <p className="mt-2 font-mono text-xs text-muted">
                    check_key: {finding.checkKey}
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-sm text-accent hover:underline"
                    onClick={() =>
                      setExpandedFindingId(
                        expandedFindingId === finding.id ? null : finding.id,
                      )
                    }
                  >
                    {expandedFindingId === finding.id ? "Hide evidence" : "Show evidence"}
                  </button>
                  {expandedFindingId === finding.id ? (
                    <pre className="mt-2 max-h-64 overflow-auto rounded bg-background p-3 text-xs">
                      {JSON.stringify(finding.evidenceJson, null, 2)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      ) : null}

      {tab === "recommendations" ? (
        <Panel title="Recommendations">
          <ul className="space-y-4">
            {detail.recommendations.map((rec) => (
              <li
                key={rec.id}
                className="rounded-md border border-border p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{rec.title}</p>
                    <p className="text-xs text-muted">
                      {rec.priority} · Impact: {rec.impact ?? "—"} · Effort:{" "}
                      {rec.effort ?? "—"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {rec.isPublic ? <StatusPill label="Marketing" tone="neutral" /> : null}
                    {rec.isClientVisible ? (
                      <StatusPill label="Client" tone="neutral" />
                    ) : null}
                  </div>
                </div>
                <p className="mt-2 text-sm">{rec.description}</p>
                {rec.supportingFindingKeys.length > 0 ? (
                  <p className="mt-2 font-mono text-xs text-muted">
                    Related checks: {rec.supportingFindingKeys.join(", ")}
                  </p>
                ) : null}
                {rec.signalworksServiceKey ? (
                  <p className="mt-1 text-xs text-muted">
                    Service: {rec.signalworksServiceKey}
                  </p>
                ) : null}
                <label className="mt-3 block text-sm">
                  <span className="font-medium">Workflow status</span>
                  <select
                    value={rec.status}
                    disabled={updatingRecId === rec.id}
                    onChange={(event) =>
                      updateRecommendationStatus(rec.id, event.target.value)
                    }
                    className="mt-1 block w-full max-w-xs rounded-md border border-border bg-background px-3 py-2"
                  >
                    {RECOMMENDATION_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            ))}
            {detail.recommendations.length === 0 ? (
              <p className="text-sm text-muted">No recommendations.</p>
            ) : null}
          </ul>
        </Panel>
      ) : null}

      {tab === "history" ? (
        <Panel title="History comparison">
          {!detail.history ? (
            <p className="text-sm text-muted">No previous audit to compare.</p>
          ) : (
            <div className="space-y-6">
              <dl>
                <MetaRow
                  label="Overall score change"
                  value={formatScoreChange(detail.history.overallScoreChange)}
                />
                <MetaRow
                  label="Previous run"
                  value={
                    detail.history.previousRunId ? (
                      <Link
                        href={`/admin/audits/${detail.history.previousRunId}`}
                        className="text-accent hover:underline"
                      >
                        {formatDateTime(detail.history.previousCompletedAt)}
                      </Link>
                    ) : (
                      "—"
                    )
                  }
                />
              </dl>

              <div>
                <h3 className="mb-2 text-sm font-medium">Category changes</h3>
                <ul className="space-y-1 text-sm">
                  {detail.history.categoryChanges.map((row) => (
                    <li key={row.category}>
                      <span className="capitalize">{row.category}</span>:{" "}
                      {row.previousScore ?? "—"} → {row.currentScore}
                      {row.change != null ? ` (${formatScoreChange(row.change)})` : ""}
                    </li>
                  ))}
                </ul>
              </div>

              <HistoryList title="New findings" items={detail.history.newFindings} />
              <HistoryList
                title="Resolved findings"
                items={detail.history.resolvedFindings}
              />
              <HistoryList
                title="Recurring findings"
                items={detail.history.recurringFindings}
              />
            </div>
          )}
        </Panel>
      ) : null}

      {tab === "report" ? (
        <Panel title="HTML report">
          <p className="text-sm text-muted">
            Print-friendly report rendered from immutable audit data. HTML is not stored
            unless explicitly exported.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink
              href={`/api/admin/audits/${detail.runId}/report`}
              target="_blank"
            >
              Open report
            </ButtonLink>
            <Button
              type="button"
              variant="secondary"
              onClick={() => window.print()}
            >
              Print this page
            </Button>
          </div>
        </Panel>
      ) : null}

      {tab === "notes" ? (
        <Panel title="Internal notes">
          {detail.internalNotes ? (
            <p className="whitespace-pre-wrap text-sm">{detail.internalNotes}</p>
          ) : (
            <p className="text-sm text-muted">No internal notes for this audit request.</p>
          )}
        </Panel>
      ) : null}
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number | null }) {
  const status = scoreStatus(value);
  return <div className="rounded-xl border border-border bg-surface p-5"><p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p><p className="mt-3 font-display text-4xl">{value == null ? "—" : Math.round(value)}</p><StatusPill label={status.label} tone={status.tone} /></div>;
}

function UnavailableMetric({ title, text }: { title: string; text: string }) {
  return <div className="rounded-lg border border-dashed border-border p-4"><div className="flex items-center justify-between gap-3"><p className="font-medium">{title}</p><span className="font-display text-2xl text-muted">—</span></div><p className="mt-1 text-sm text-muted">{text}</p><p className="mt-3 text-xs font-medium text-muted">Ranking data will appear here when connected.</p></div>;
}

function CategoryCard({ row }: { row: AuditRunDetail["scores"][number] }) {
  const presentation = categoryPresentation(row.category);
  const status = scoreStatus(row.score);
  return <details className="group rounded-xl border border-border bg-surface p-5"><summary className="cursor-pointer list-none"><div className="flex items-start justify-between gap-4"><div><p className="font-medium">{presentation.label}</p><p className="mt-1 text-sm leading-6 text-muted">{presentation.description}</p></div><div className="text-right"><p className="font-display text-3xl">{Math.round(row.score)}</p><StatusPill label={status.label} tone={status.tone} /></div></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-foreground" style={{ width: `${Math.max(0, Math.min(100, row.score))}%` }} /></div></summary><div className="mt-4 border-t border-border pt-4 text-sm text-muted"><p>{row.findingCount} checks analyzed · {row.weight}% weight</p><p className="mt-2 text-xs">Select the Findings tab below for evidence and technical check details.</p></div></details>;
}

function InsightSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-border bg-surface p-6"><h2 className="font-display text-3xl">{title}</h2><p className="mt-2 text-sm text-muted">{description}</p><div className="mt-5">{children}</div></section>;
}

function HistoryList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted">None</p>
      ) : (
        <ul className="list-disc space-y-1 pl-5 font-mono text-xs">
          {items.map((key) => (
            <li key={key}>{key}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
