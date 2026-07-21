/** Shared multi-tenant platform + client portal tables (ADR 0001–0003). */
export const TABLES = {
  profiles: "profiles",
  tenants: "tenants",
  tenantMemberships: "tenant_memberships",
  roles: "roles",
  tenantPortalSettings: "tenant_portal_settings",
  tenantSubscriptions: "tenant_subscriptions",
  serviceRequests: "service_requests",
  documents: "documents",
  // Phase 1 — client management
  tenantProfiles: "tenant_profiles",
  tenantTechnicalProfiles: "tenant_technical_profiles",
  tenantContacts: "tenant_contacts",
  legalDocuments: "legal_documents",
  clientOffers: "client_offers",
  clientOfferItems: "client_offer_items",
  purchases: "purchases",
  purchaseItems: "purchase_items",
  agreementAcceptances: "agreement_acceptances",
  tenantActivityLog: "tenant_activity_log",
  stripeWebhookEvents: "stripe_webhook_events",
  tenantInternalNotes: "tenant_internal_notes",
} as const;

/** @deprecated Use TABLES */
export const SW_TABLES = TABLES;
