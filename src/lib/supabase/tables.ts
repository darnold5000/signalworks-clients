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
} as const;

/** @deprecated Use TABLES */
export const SW_TABLES = TABLES;
