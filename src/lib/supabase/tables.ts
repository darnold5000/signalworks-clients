/**
 * Signal Works portal tables in the shared Dugout Intel Supabase project.
 * Prefixed to avoid collisions with dawg_*, ch_*, and other apps.
 */
export const SW_TABLES = {
  profiles: "sw_profiles",
  clients: "sw_clients",
  clientMembers: "sw_client_members",
  serviceRequests: "sw_service_requests",
  documents: "sw_documents",
} as const;
