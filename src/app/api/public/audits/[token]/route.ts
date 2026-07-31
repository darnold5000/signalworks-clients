import { NextResponse, type NextRequest } from "next/server";

import {
  isPublicAuditApiAuthorized,
  publicAuditUnauthorizedResponse,
} from "@/lib/audit/public/auth";
import { withPublicAuditCors, publicAuditCorsHeaders } from "@/lib/audit/public/cors";
import { getPublicAuditByToken } from "@/lib/audit/public/queries";
import {
  checkPublicAuditRateLimit,
  getClientIp,
} from "@/lib/audit/public/rate-limit";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: publicAuditCorsHeaders(request),
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  if (!isPublicAuditApiAuthorized(request)) {
    return withPublicAuditCors(request, publicAuditUnauthorizedResponse());
  }

  const { token } = await context.params;
  const rateLimit = checkPublicAuditRateLimit(`read:${getClientIp(request)}:${token.slice(0, 8)}`);
  if (!rateLimit.ok) {
    return withPublicAuditCors(
      request,
      NextResponse.json(
        { error: "Too many requests." },
        {
          status: 429,
          headers: rateLimit.retryAfterSec
            ? { "Retry-After": String(rateLimit.retryAfterSec) }
            : undefined,
        },
      ),
    );
  }

  try {
    const detail = await getPublicAuditByToken(token);
    if (!detail) {
      return withPublicAuditCors(
        request,
        NextResponse.json({ error: "Audit not found." }, { status: 404 }),
      );
    }

    return withPublicAuditCors(request, NextResponse.json(detail));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load audit.";
    return withPublicAuditCors(
      request,
      NextResponse.json({ error: message }, { status: 500 }),
    );
  }
}
