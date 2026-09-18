export type SecurityHeader = {
  key: string;
  value: string;
};

/** Portal is never indexed. Applied via next.config.ts. */
export function buildSecurityHeaders(): SecurityHeader[] {
  return [
    { key: "X-Robots-Tag", value: "noindex, nofollow" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
  ];
}
