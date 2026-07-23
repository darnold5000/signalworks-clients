export type PipelineStatus =
  | "potential"
  | "reached_out"
  | "contact_made"
  | "conversation_ongoing"
  | "proposal_sent"
  | "won"
  | "not_interested";

export const PIPELINE_TAGS = [
  "Gym",
  "Hair Salon",
  "Golf",
  "Financial",
  "Retail",
  "Restaurant",
  "Healthcare",
  "Other",
] as const;

export type PipelineTag = (typeof PIPELINE_TAGS)[number];

export interface ClientPipelineRecord {
  id: string;
  tenant_id: string;
  business_name: string;
  contact_name: string;
  contact_email: string | null;
  phone: string | null;
  website_url: string | null;
  status: PipelineStatus;
  last_conversation: string | null;
  plan: string | null;
  estimated_monthly_value_cents: number | null;
  next_follow_up_date: string | null;
  last_contacted_at: string | null;
  tags: PipelineTag[];
  created_at: string;
  updated_at: string;
}

export type PipelineSortKey =
  | "business_name"
  | "status"
  | "updated_at"
  | "next_follow_up_date";

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
