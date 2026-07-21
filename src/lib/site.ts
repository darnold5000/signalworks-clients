function isLocalHost(host: string): boolean {
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local")
  );
}

/** App origin for redirects (invites, Stripe). Prefers the live request host on Vercel. */
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
  if (configured) return configured.replace(/\/$/, "");

  return "http://localhost:3000";
}

export const siteConfig = {
  name: "Signal Works",
  productName: "Client Portal",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  marketingUrl: "https://hiresignalworks.com",
  supportEmail: "hello@hiresignalworks.com",
} as const;
