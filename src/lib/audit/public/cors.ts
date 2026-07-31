import { siteConfig } from "@/lib/site";

const LOCAL_MARKETING_ORIGINS = [
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://localhost:3002",
  "http://127.0.0.1:3002",
];

export function publicAuditCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin");
  const allowedOrigins = new Set([
    siteConfig.marketingUrl,
    ...LOCAL_MARKETING_ORIGINS,
    process.env.MARKETING_SITE_URL?.replace(/\/$/, ""),
  ].filter(Boolean) as string[]);

  if (!origin || !allowedOrigins.has(origin)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-audit-api-key",
    Vary: "Origin",
  };
}

export function withPublicAuditCors(
  request: Request,
  response: Response,
): Response {
  const headers = publicAuditCorsHeaders(request);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}
