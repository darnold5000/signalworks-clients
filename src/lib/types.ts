export type UserRole = "client" | "admin";

export type ClientStatus =
  | "active"
  | "onboarding"
  | "paused"
  | "canceled"
  | "past_due";

export type WebsiteStatus = "live" | "building" | "staging" | "offline";
export type HostingStatus = "active" | "pending" | "error" | "none";
export type SslStatus = "active" | "pending" | "error" | "none";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "unpaid"
  | "none";

export type RequestType =
  | "text_change"
  | "new_photo"
  | "hours_update"
  | "new_service"
  | "scheduling_update"
  | "new_page_or_feature"
  | "other";

export type RequestStatus =
  | "submitted"
  | "in_progress"
  | "waiting_on_client"
  | "completed"
  | "canceled";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  slug: string;
  business_name: string;
  status: ClientStatus;
  website_status: WebsiteStatus;
  website_url: string | null;
  domain: string | null;
  domain_owner: string | null;
  registrar: string | null;
  hosting_platform: string | null;
  hosting_status: HostingStatus;
  ssl_status: SslStatus;
  database_platform: string | null;
  plan_name: string;
  monthly_price_cents: number;
  currency: string;
  intro_price_cents: number | null;
  intro_expires_on: string | null;
  contract_start_on: string | null;
  updates_included_per_month: number;
  updates_used_this_month: number;
  last_deployment_at: string | null;
  last_backup_at: string | null;
  analytics_summary: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  subscription_status: SubscriptionStatus;
  current_period_end: string | null;
  estimated_infra_cost_cents: number;
  support_email: string | null;
  support_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ServiceRequest = {
  id: string;
  client_id: string;
  created_by: string | null;
  request_type: RequestType;
  title: string;
  description: string;
  status: RequestStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type Document = {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  file_url: string;
  created_at: string;
};

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  text_change: "Text change",
  new_photo: "New photo",
  hours_update: "Hours update",
  new_service: "New service",
  scheduling_update: "Scheduling update",
  new_page_or_feature: "New page or feature",
  other: "Other",
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  submitted: "Submitted",
  in_progress: "In progress",
  waiting_on_client: "Waiting on client",
  completed: "Completed",
  canceled: "Canceled",
};
