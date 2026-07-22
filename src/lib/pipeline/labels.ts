import type { PipelineStatus } from "@/lib/pipeline/types";

export const PIPELINE_STATUS_LABELS: Record<PipelineStatus, string> = {
  potential: "Potential Client",
  reached_out: "Reached Out",
  contact_made: "Contact Made",
  conversation_ongoing: "Conversation Ongoing",
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
    case "conversation_ongoing":
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
  { key: "conversation_ongoing", label: "Conversation Ongoing" },
  { key: "proposal_sent", label: "Proposal Sent" },
  { key: "won", label: "Won" },
  { key: "not_interested", label: "Not Interested" },
];
