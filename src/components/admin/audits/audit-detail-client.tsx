"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, ButtonLink, MetaRow, Panel, StatusPill } from "@/components/ui";
import {
  AUDIT_STATUS_LABELS,
  AUDIT_TYPE_LABELS,
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
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted">
            {AUDIT_TYPE_LABELS[detail.auditType] ?? detail.auditType}
            {detail.tenantName ? ` · ${detail.tenantName}` : ""}
          </p>
          <h1 className="font-display text-3xl tracking-tight">
            {detail.businessName ?? detail.normalizedDomain}
          </h1>
          <p className="mt-1 text-sm text-muted">{detail.normalizedUrl}</p>
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
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Overall score">
            <p className="font-display text-5xl">{detail.overallScore ?? "—"}</p>
            {coverageLabel ? (
              <p className="mt-2 text-sm font-medium text-warning">{coverageLabel}</p>
            ) : null}
            {confidenceLabel ? (
              <p className="mt-1 text-sm text-muted">Confidence: {confidenceLabel}</p>
            ) : null}
            {scoring?.unavailableCategories?.length ? (
              <p className="mt-2 text-sm text-muted">
                Unavailable: {scoring.unavailableCategories.join(", ")}
              </p>
            ) : null}
            <dl className="mt-4">
              <MetaRow label="Audit date" value={formatDateTime(detail.completedAt ?? detail.createdAt)} />
              <MetaRow label="Scoring version" value={scoring?.scoringVersion ?? detail.engineVersion} />
              <MetaRow label="Scope version" value={detail.scopeVersion} />
            </dl>
          </Panel>

          <Panel title="Category scores">
            <ul className="space-y-2">
              {detail.scores.map((row) => (
                <li
                  key={row.category}
                  className="flex items-center justify-between border-b border-border pb-2 text-sm last:border-0"
                >
                  <span className="capitalize">{row.category}</span>
                  <span className="font-medium">{row.score}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Top strengths">
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {(scoring?.strengths ?? []).slice(0, 5).map((item) => (
                <li key={item.checkKey}>{item.title}</li>
              ))}
              {(scoring?.strengths ?? []).length === 0 ? (
                <li className="list-none pl-0 text-muted">None listed.</li>
              ) : null}
            </ul>
          </Panel>

          <Panel title="Top opportunities">
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {(scoring?.opportunities ?? []).slice(0, 5).map((item) => (
                <li key={item.checkKey}>{item.title}</li>
              ))}
              {(scoring?.opportunities ?? []).length === 0 ? (
                <li className="list-none pl-0 text-muted">None listed.</li>
              ) : null}
            </ul>
          </Panel>

          <Panel title="Data sources" className="lg:col-span-2">
            <p className="text-sm text-muted">
              Collectors: {collectorLabels.join(", ") || "—"}
            </p>
            {detail.summary ? (
              <p className="mt-3 text-sm">{detail.summary}</p>
            ) : null}
          </Panel>
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
