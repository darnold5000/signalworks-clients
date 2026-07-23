export type PipelineStatus =
  | "potential"
  | "reached_out"
  | "contact_made"
  | "conversation_ongoing"
  | "proposal_sent"
  | "won"
  | "not_interested";

export interface ClientPipelineRecord {
  id: string;
  tenant_id: string;
  business_name: string;
  contact_name: string;
  status: PipelineStatus;
  last_conversation: string | null;
  plan: string | null;
  created_at: string;
  updated_at: string;
}

export type PipelineSortKey = "business_name" | "status" | "updated_at";

export type PipelineSortDirection = "asc" | "desc";

export const PIPELINE_STATUSES: PipelineStatus[] = [
  "potential",
  "reached_out",
  "contact_made",
  "conversation_ongoing",
  "proposal_sent",
  "won",
  "not_interested",
];
