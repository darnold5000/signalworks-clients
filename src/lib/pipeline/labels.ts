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

export type PipelineStatusTone =
  | "neutral"
  | "blue"
  | "purple"
  | "warning"
  | "orange"
  | "success"
  | "danger";

export function pipelineStatusTone(status: PipelineStatus): PipelineStatusTone {
  switch (status) {
    case "potential":
      return "neutral";
    case "reached_out":
      return "blue";
    case "contact_made":
      return "purple";
    case "interested":
      return "warning";
    case "proposal_sent":
      return "orange";
    case "won":
      return "success";
    case "not_interested":
      return "danger";
    default:
      return "neutral";
  }
}

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
