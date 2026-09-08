import type { LeadTemperature, PipelineStatus } from "@/lib/pipeline/types";

export const PIPELINE_STATUS_LABELS: Record<PipelineStatus, string> = {
  potential: "Potential Client",
  reached_out: "Reached Out",
  contact_made: "Contact Made",
  interested: "Interested",
  proposal_sent: "Proposal Sent",
  won: "Won",
  not_interested: "Not Interested",
};

export const PIPELINE_FILTER_OPTIONS: {
  key: "all" | PipelineStatus;
  label: string;
}[] = [
  { key: "all", label: "All" },
  { key: "potential", label: "Potential" },
  { key: "reached_out", label: "Reached Out" },
  { key: "contact_made", label: "Contact Made" },
  { key: "interested", label: "Interested" },
  { key: "proposal_sent", label: "Proposal Sent" },
  { key: "won", label: "Won" },
  { key: "not_interested", label: "Not Interested" },
];

export const LEAD_TEMPERATURE_LABELS: Record<LeadTemperature, string> = {
  hot: "🔥 Hot",
  warm: "Warm",
  lukewarm: "Lukewarm",
  cold: "Cold",
  unknown: "Unknown",
};

export const LEAD_TEMPERATURE_DEFINITIONS: Record<LeadTemperature, string> = {
  hot: "Very interested and actively engaged. Strong signs they may move forward.",
  warm: "Clearly interested and responsive, but not yet actively moving toward closing.",
  lukewarm:
    "Has expressed some interest, but momentum is weak, responses are inconsistent, or they may be difficult to re-engage.",
  cold: "Little current interest, repeatedly unresponsive, declined for now, or unlikely to move forward without something changing.",
  unknown: "Not enough interaction yet to reasonably judge.",
};

export const LEAD_TEMPERATURE_FILTER_OPTIONS: {
  key: "all" | LeadTemperature;
  label: string;
}[] = [
  { key: "all", label: "All" },
  { key: "hot", label: "🔥 Hot" },
  { key: "warm", label: "Warm" },
  { key: "lukewarm", label: "Lukewarm" },
  { key: "cold", label: "Cold" },
  { key: "unknown", label: "Unknown" },
];

export function pipelineStatusPillClass(status: PipelineStatus): string {
  switch (status) {
    case "potential":
    case "not_interested":
      return "border-border bg-background text-muted";
    case "interested":
      return "border-amber-200/70 bg-amber-50/70 text-foreground";
    case "proposal_sent":
      return "border-orange-200/60 bg-orange-50/50 text-foreground";
    case "won":
      return "border-emerald-200/70 bg-emerald-50/60 text-foreground";
    default:
      return "border-border bg-background text-foreground";
  }
}

export function leadTemperaturePillClass(temperature: LeadTemperature): string {
  switch (temperature) {
    case "hot":
      return "border-orange-200/80 bg-orange-50 font-semibold text-orange-950";
    case "warm":
      return "border-orange-100 bg-orange-50/50 text-foreground";
    case "cold":
      return "border-slate-200 bg-slate-50 text-slate-600";
    case "unknown":
      return "border-dashed border-border bg-transparent text-muted";
    default:
      return "border-border bg-background text-muted";
  }
}
