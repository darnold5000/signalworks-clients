/**
 * Phase 1 client management schema types.
 * Mirror of signalworks-clients/supabase/migrations/003_client_management_phase1.sql
 */

// ---------------------------------------------------------------------------
// Status unions
// ---------------------------------------------------------------------------

export type TenantInternalStatus =
  | "prospect"
  | "invited"
  | "onboarding"
  | "awaiting_agreement"
  | "awaiting_payment"
  | "active"
  | "past_due"
  | "paused"
  | "canceled"
  | "archived";

export type TenantOnboardingStatus =
  | "invited"
  | "account_created"
  | "company_information_confirmed"
  | "offer_viewed"
  | "terms_accepted"
  | "checkout_started"
  | "payment_complete"
  | "onboarding_complete";

export type TenantInternalNoteSubjectType = "profile" | "contact" | "general";

export type TenantContactType =
  | "owner"
  | "billing"
  | "technical"
  | "marketing"
  | "operations"
  | "other";

export type LegalDocumentType =
  | "terms_of_service"
  | "service_agreement"
  | "privacy_policy"
  | "acceptable_use_policy"
  | "custom_addendum";

export type ClientOfferStatus =
  | "draft"
  | "published"
  | "viewed"
  | "accepted"
  | "checkout_started"
  | "purchased"
  | "expired"
  | "canceled";

export type ClientOfferItemType =
  | "base_plan"
  | "setup_fee"
  | "add_on"
  | "custom_service"
  | "credit"
  | "discount";

export type BillingType = "one_time" | "recurring";

export type BillingInterval = "day" | "week" | "month" | "year";

export type DiscountType = "amount" | "percent";

export type DiscountDurationType = "once" | "repeating" | "forever";

export type PurchaseStatus =
  | "pending"
  | "checkout_created"
  | "active"
  | "paid"
  | "past_due"
  | "canceled"
  | "refunded"
  | "failed";

export type PurchaseItemServiceStatus =
  | "pending"
  | "active"
  | "paused"
  | "canceled"
  | "completed"
  | "failed";

export type ActivityActorType =
  | "user"
  | "admin"
  | "system"
  | "stripe_webhook";

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export type TenantProfile = {
  tenant_id: string;
  legal_business_name: string | null;
  display_name: string | null;
  business_type: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  billing_contact_name: string | null;
  billing_contact_email: string | null;
  website_url: string | null;
  primary_domain: string | null;
  support_email: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  logo_url: string | null;
  internal_status: TenantInternalStatus;
  onboarding_status: TenantOnboardingStatus;
  created_at: string;
  updated_at: string;
};

export type TenantTechnicalProfile = {
  tenant_id: string;
  architecture_type: string | null;
  repository_provider: string | null;
  repository_owner: string | null;
  repository_name: string | null;
  repository_url: string | null;
  default_branch: string | null;
  hosting_provider: string | null;
  hosting_project_name: string | null;
  hosting_project_id: string | null;
  production_url: string | null;
  domain_registrar: string | null;
  dns_provider: string | null;
  primary_domain: string | null;
  database_provider: string | null;
  database_project_name: string | null;
  database_project_reference: string | null;
  database_region: string | null;
  database_schema_name: string | null;
  storage_provider: string | null;
  storage_bucket_names: string[] | null;
  stripe_account_type: string | null;
  stripe_connected_account_id: string | null;
  email_provider: string | null;
  email_sending_domain: string | null;
  analytics_provider: string | null;
  analytics_property_id: string | null;
  source_code_ownership: string | null;
  backup_policy: string | null;
  last_backup_verified_at: string | null;
  deployment_notes: string | null;
  technical_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TenantContact = {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  contact_type: TenantContactType;
  is_primary: boolean;
  is_billing_contact: boolean;
  is_technical_contact: boolean;
  created_at: string;
  updated_at: string;
};

export type TenantInternalNote = {
  id: string;
  tenant_id: string;
  subject_type: TenantInternalNoteSubjectType;
  subject_id: string | null;
  body: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LegalDocument = {
  id: string;
  tenant_id: string | null;
  document_type: LegalDocumentType;
  title: string;
  version: string;
  content_html: string;
  content_text: string | null;
  effective_date: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
};

export type ClientOffer = {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  status: ClientOfferStatus;
  currency: string;
  valid_from: string | null;
  expires_at: string | null;
  terms_document_id: string | null;
  requires_terms_acceptance: boolean;
  subtotal_cents: number;
  discount_total_cents: number;
  initial_total_cents: number;
  recurring_total_cents: number;
  created_by: string | null;
  published_at: string | null;
  accepted_at: string | null;
  purchased_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientOfferItem = {
  id: string;
  offer_id: string;
  tenant_id: string;
  item_type: ClientOfferItemType;
  name: string;
  description: string | null;
  quantity: number;
  unit_amount_cents: number;
  billing_type: BillingType;
  billing_interval: BillingInterval | null;
  billing_interval_count: number;
  discount_type: DiscountType | null;
  discount_amount_cents: number | null;
  discount_percent: number | null;
  discount_duration_type: DiscountDurationType | null;
  discount_duration_months: number | null;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  stripe_coupon_id: string | null;
  is_optional: boolean;
  is_selected: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Purchase = {
  id: string;
  tenant_id: string;
  offer_id: string | null;
  status: PurchaseStatus;
  currency: string;
  subtotal_cents: number;
  discount_total_cents: number;
  amount_due_today_cents: number;
  recurring_total_cents: number;
  stripe_customer_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_subscription_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_invoice_id: string | null;
  purchased_by: string | null;
  purchased_at: string | null;
  purchase_snapshot: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PurchaseItem = {
  id: string;
  purchase_id: string;
  tenant_id: string;
  source_offer_item_id: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unit_amount_cents: number;
  billing_type: BillingType;
  billing_interval: BillingInterval | null;
  discount_summary: string | null;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  service_status: PurchaseItemServiceStatus;
  created_at: string;
  updated_at: string;
};

export type AgreementAcceptance = {
  id: string;
  tenant_id: string;
  user_id: string | null;
  offer_id: string | null;
  legal_document_id: string;
  document_version: string;
  accepted_name: string;
  accepted_email: string;
  accepted_at: string;
  ip_address: string | null;
  user_agent: string | null;
  document_snapshot_html: string;
  document_hash: string;
  created_at: string;
};

export type TenantActivityLogEntry = {
  id: string;
  tenant_id: string;
  actor_user_id: string | null;
  actor_type: ActivityActorType;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type StripeWebhookEvent = {
  id: string;
  stripe_event_id: string;
  event_type: string;
  livemode: boolean;
  processed: boolean;
  processing_error: string | null;
  payload: Record<string, unknown> | null;
  received_at: string;
  processed_at: string | null;
};

/** Extended columns on existing tenant_subscriptions (001_client_portal). */
export type TenantSubscriptionExtended = {
  id: string;
  tenant_id: string;
  purchase_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  subscription_status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  standard_amount_cents: number | null;
  current_discount_amount_cents: number | null;
  current_effective_amount_cents: number | null;
  discount_ends_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Client-visible offer statuses (matches client_offer_visible_to_member). */
export const CLIENT_VISIBLE_OFFER_STATUSES: readonly ClientOfferStatus[] = [
  "published",
  "viewed",
  "accepted",
  "checkout_started",
  "purchased",
  "expired",
] as const;
