function isLocalHost(host: string): boolean {
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local")
  );
}

function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export const productionPortalUrl = "https://clients.hiresignalworks.com";

/** Production portal origin for client invite links — never localhost. */
export function portalUrlForInvites(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (configured && !isLocalAppUrl(configured)) {
    return configured;
  }
  return productionPortalUrl;
}

/** App origin for Stripe return URLs (may be localhost in local dev). */
export function resolveAppUrl(request?: Request): string {
  if (request) {
    const forwardedHost = request.headers.get("x-forwarded-host");
    const host =
      forwardedHost?.split(",")[0]?.trim() ??
      request.headers.get("host")?.trim();
    if (host && !isLocalHost(host)) {
      const proto =
        request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
        "https";
      return `${proto}://${host}`;
    }
  }

  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    const normalized = configured.replace(/\/$/, "");
    const configuredHost = hostFromUrl(normalized);
    if (
      process.env.VERCEL_ENV === "production" &&
      configuredHost &&
      isLocalHost(configuredHost)
    ) {
      // Misconfigured Vercel env — fall through to error in invite route.
    } else {
      return normalized;
    }
  }

  return "http://localhost:3000";
}

/** Where Supabase should send users after they click an invite link. */
export function inviteRedirectUrl(appUrl: string): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/auth/callback?next=${encodeURIComponent("/auth/set-password")}`;
}

/** Where Supabase should send users after they click a password recovery link. */
export function recoveryRedirectUrl(appUrl: string): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`;
}

/** After sign-in, land on the active proposal. */
export function offerRedirectUrl(appUrl: string): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/auth/callback?next=${encodeURIComponent("/offer")}`;
}

/** Plain login link when the client already has a password. */
export function loginWithNextUrl(appUrl: string, nextPath = "/offer"): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/login?next=${encodeURIComponent(nextPath)}`;
}

/** Force the correct redirect_to on Supabase verify links embedded in email. */
export function ensureInviteActionLink(
  actionLink: string,
  redirectTo: string,
): string {
  try {
    const url = new URL(actionLink);
    url.searchParams.set("redirect_to", redirectTo);
    return url.toString();
  } catch {
    return actionLink;
  }
}

export function isLocalAppUrl(appUrl: string): boolean {
  const host = hostFromUrl(appUrl);
  return host ? isLocalHost(host) : true;
}

export const siteConfig = {
  name: "Signal Works",
  productName: "Client Portal",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  marketingUrl: "https://hiresignalworks.com",
  supportEmail: "hello@hiresignalworks.com",
} as const;
