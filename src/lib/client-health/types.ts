import type {
  OperationsHealthProvider,
  OperationsHealthStatus,
} from "@/lib/client-health/constants";

export type TenantOperationsHealth = {
  tenant_id: string;
  overall_status: OperationsHealthStatus;
  website_status: OperationsHealthStatus;
  website_response_ms: number | null;
  website_uptime_24h: number | null;
  website_uptime_7d: number | null;
  website_uptime_30d: number | null;
  ssl_status: OperationsHealthStatus;
  ssl_issuer: string | null;
  ssl_valid_from: string | null;
  ssl_expires_at: string | null;
  ssl_days_remaining: number | null;
  domain_status: OperationsHealthStatus;
  domain_expires_at: string | null;
  domain_days_remaining: number | null;
  vercel_status: OperationsHealthStatus;
  vercel_last_deployment_status: string | null;
  vercel_last_deployment_at: string | null;
  supabase_status: OperationsHealthStatus;
  supabase_database_status: string | null;
  supabase_auth_status: string | null;
  supabase_storage_status: string | null;
  twilio_status: OperationsHealthStatus;
  twilio_sms_count_month: number | null;
  twilio_sms_cost_month: number | null;
  twilio_failed_sms_month: number | null;
  last_checked_at: string | null;
  last_error: string | null;
  providers: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type TenantOperationsHealthProvider = {
  tenant_id: string;
  provider: OperationsHealthProvider;
  status: OperationsHealthStatus;
  last_success_at: string | null;
  last_attempt_at: string | null;
  last_error: string | null;
  snapshot: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
