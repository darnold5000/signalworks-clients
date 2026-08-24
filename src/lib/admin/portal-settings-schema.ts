import { z } from "zod";

const websiteSecurityStatus = z.enum([
  "protected",
  "needs_attention",
  "issue_detected",
]);

const hostingStatus = z.enum(["active", "pending", "error", "none"]);

const optionalIsoDate = z
  .string()
  .datetime({ offset: true })
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));

export const portalWebsiteSettingsUpdateSchema = z.object({
  domain: z.string().trim().max(255).nullable().optional(),
  hosting_status: hostingStatus.optional(),
  website_last_updated_at: optionalIsoDate,
  website_security_status: websiteSecurityStatus.optional(),
  website_security_https_enabled: z.boolean().nullable().optional(),
  website_security_cert_valid: z.boolean().nullable().optional(),
  website_security_cert_expires_at: optionalIsoDate,
  plan_inclusions: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  setup_inclusions: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
});

export type PortalWebsiteSettingsUpdate = z.infer<
  typeof portalWebsiteSettingsUpdateSchema
>;
