export type PipelineStatus =
  | "potential"
  | "reached_out"
  | "contact_made"
  | "interested"
  | "proposal_sent"
  | "won"
  | "not_interested";

export const PIPELINE_TAGS = [
  "Gym",
  "Sports Organization",
  "Instructor",
  "Food Truck",
  "Beverage Shop",
  "Hair Salon",
  "Golf",
  "Financial",
  "Contractor",
  "Other",
] as const;

export const LEGACY_PIPELINE_TAGS = [
  "Restaurant",
  "Healthcare",
  "Retail",
] as const;

export type PipelineTag =
  | (typeof PIPELINE_TAGS)[number]
  | (typeof LEGACY_PIPELINE_TAGS)[number];

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
  health_check_sent: boolean;
  tags: PipelineTag[];
  created_at: string;
  updated_at: string;
}

export type PipelineSortKey =
  | "business_name"
  | "status"
  | "updated_at"
  | "last_contacted_at";

export type PipelineSortDirection = "asc" | "desc";

export const PIPELINE_STATUSES: PipelineStatus[] = [
  "potential",
  "reached_out",
  "contact_made",
  "interested",
  "proposal_sent",
  "won",
  "not_interested",
];
