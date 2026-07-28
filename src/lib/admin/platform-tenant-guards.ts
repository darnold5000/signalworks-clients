/** Live product tenants — never delete from the portal admin UI. */
export const PLATFORM_APP_TENANT_SLUGS = [
  "signalworks",
  "ma5-performance",
  "dawg-youth-training",
] as const;

export function isPlatformAppTenantSlug(slug: string): boolean {
  return (PLATFORM_APP_TENANT_SLUGS as readonly string[]).includes(slug);
}

export function canDeletePortalClientTenant(args: {
  slug: string;
  platformCategory: string;
}): { allowed: true } | { allowed: false; reason: string } {
  if (args.platformCategory === "internal") {
    return {
      allowed: false,
      reason: "Internal platform tenants cannot be deleted from here.",
    };
  }
  if (isPlatformAppTenantSlug(args.slug)) {
    return {
      allowed: false,
      reason:
        "This tenant powers a live Signal Works app. It cannot be removed from the client portal.",
    };
  }
  return { allowed: true };
}
