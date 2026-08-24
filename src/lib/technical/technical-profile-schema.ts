import { z } from "zod";
import {
  ACCESS_VENDOR_KEYS,
  SERVICE_OWNERSHIP_KEYS,
} from "@/lib/technical/operations-inventory";

const optionalString = z
  .string()
  .trim()
  .transform((s) => (s.length === 0 ? null : s))
  .nullable()
  .optional();

const optionalBool = z.boolean().nullable().optional();

const serviceOwnershipSchema = z
  .record(z.string(), z.string())
  .optional()
  .transform((raw) => {
    if (!raw) return {};
    const out: Record<string, string> = {};
    for (const key of SERVICE_OWNERSHIP_KEYS) {
      const v = raw[key];
      if (v === "signal_works" || v === "client" || v === "shared") {
        out[key] = v;
      }
    }
    return out;
  });

const accessEntrySchema = z.object({
  signal_works_access: z.boolean().optional(),
  client_access: z.boolean().optional(),
  recovery_configured: z.boolean().optional(),
  mfa_enabled: z.boolean().optional(),
  notes: optionalString,
});

const accessStatusSchema = z
  .record(z.string(), accessEntrySchema)
  .optional()
  .transform((raw) => {
    if (!raw) return {};
    const out: Record<string, z.infer<typeof accessEntrySchema>> = {};
    for (const key of ACCESS_VENDOR_KEYS) {
      if (raw[key]) out[key] = raw[key];
    }
    return out;
  });

const apiIntegrationEntrySchema = z.object({
  enabled: z.boolean(),
  name: optionalString,
  account_owner: optionalString,
  notes: optionalString,
});

const apiIntegrationsSchema = z
  .record(z.string().regex(/^[a-z0-9_]{1,80}$/), apiIntegrationEntrySchema)
  .optional()
  .transform((raw) => raw ?? {});

const businessServicesSchema = z.record(z.string(), z.unknown()).optional();

const monitoringConfigSchema = z
  .object({
    sentry: z.boolean().optional(),
    uptime_monitoring: z.boolean().optional(),
    backups_dashboard: z.boolean().optional(),
    analytics: z.boolean().optional(),
  })
  .optional()
  .transform((m) => m ?? {});

const managedServicesSchema = z
  .record(z.string(), z.boolean())
  .optional()
  .transform((raw) => raw ?? {});

export const technicalProfileUpdateSchema = z.object({
  architecture_type: optionalString,
  repository_provider: optionalString,
  repository_owner: optionalString,
  repository_name: optionalString,
  repository_url: optionalString,
  default_branch: optionalString,
  hosting_provider: optionalString,
  hosting_project_name: optionalString,
  hosting_project_id: optionalString,
  hosting_team_name: optionalString,
  hosting_auto_deploy: optionalBool,
  deployment_platform: optionalString,
  ssl_status: optionalString,
  production_url: optionalString,
  deployment_environment: optionalString,
  domain_registrar: optionalString,
  dns_provider: optionalString,
  primary_domain: optionalString,
  database_provider: optionalString,
  database_project_name: optionalString,
  database_project_reference: optionalString,
  database_region: optionalString,
  database_schema_name: optionalString,
  database_plan: optionalString,
  database_shared_platform: optionalBool,
  database_production_dedicated: optionalBool,
  database_infrastructure_notes: optionalString,
  storage_provider: optionalString,
  storage_bucket_names: z.array(z.string()).nullable().optional(),
  stripe_account_type: optionalString,
  stripe_connected_account_id: optionalString,
  stripe_connection_status: optionalString,
  stripe_platform_account_id: optionalString,
  stripe_test_mode_enabled: optionalBool,
  stripe_live_enabled: optionalBool,
  email_provider: optionalString,
  email_provider_tier: optionalString,
  email_sending_domain: optionalString,
  google_workspace_enabled: optionalBool,
  domain_email_provider: optionalString,
  analytics_provider: optionalString,
  analytics_property_id: optionalString,
  source_code_ownership: optionalString,
  backup_policy: optionalString,
  last_backup_verified_at: optionalString,
  deployment_notes: optionalString,
  technical_notes: optionalString,
  service_ownership: serviceOwnershipSchema,
  access_status: accessStatusSchema,
  business_services: businessServicesSchema,
  managed_services: managedServicesSchema,
  api_integrations: apiIntegrationsSchema,
  monitoring_config: monitoringConfigSchema,
});

export type TechnicalProfileUpdateInput = z.infer<
  typeof technicalProfileUpdateSchema
>;
