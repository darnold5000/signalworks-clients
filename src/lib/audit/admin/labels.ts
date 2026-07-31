export const AUDIT_TYPE_LABELS: Record<string, string> = {
  public: "Website audit",
  client_health: "Client Health",
};

export const AUDIT_STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  partially_succeeded: "Partial",
  failed: "Failed",
};

export function auditStatusTone(
  status: string,
): "neutral" | "success" | "warning" | "danger" {
  if (status === "completed") return "success";
  if (status === "partially_succeeded") return "warning";
  if (status === "failed") return "danger";
  return "neutral";
}

export const RECOMMENDATION_STATUS_OPTIONS = [
  { value: "recommended", label: "Recommended" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "dismissed", label: "Dismissed" },
  { value: "client_action_required", label: "Client action required" },
] as const;

export function formatScoreChange(change: number | null): string {
  if (change == null) return "—";
  const prefix = change > 0 ? "+" : "";
  return `${prefix}${change}`;
}
