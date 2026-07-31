import { NextResponse, type NextRequest } from "next/server";

import { executeAuditSynchronously } from "@/lib/audit/execute-audit";
import {
  isPublicAuditApiAuthorized,
  publicAuditUnauthorizedResponse,
} from "@/lib/audit/public/auth";
import { withPublicAuditCors, publicAuditCorsHeaders } from "@/lib/audit/public/cors";
import {
  createPipelineLeadForAudit,
  linkAuditRequestToPipeline,
} from "@/lib/audit/public/pipeline-lead";
import {
  checkPublicAuditRateLimit,
  getClientIp,
} from "@/lib/audit/public/rate-limit";
import { publicRunAuditSchema } from "@/lib/audit/public/validation";
import { normalizeAuditUrl, UrlValidationError } from "@/lib/audit/url/normalize";

export const maxDuration = 300;

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: publicAuditCorsHeaders(request),
  });
}

export async function POST(request: NextRequest) {
  if (!isPublicAuditApiAuthorized(request)) {
    return withPublicAuditCors(request, publicAuditUnauthorizedResponse());
  }

  const rateLimit = checkPublicAuditRateLimit(`run:${getClientIp(request)}`);
  if (!rateLimit.ok) {
    return withPublicAuditCors(
      request,
      NextResponse.json(
        { error: "Too many audit requests. Please try again shortly." },
        {
          status: 429,
          headers: rateLimit.retryAfterSec
            ? { "Retry-After": String(rateLimit.retryAfterSec) }
            : undefined,
        },
      ),
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withPublicAuditCors(
      request,
      NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }),
    );
  }

  const parsed = publicRunAuditSchema.safeParse(body);
  if (!parsed.success) {
    return withPublicAuditCors(
      request,
      NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      ),
    );
  }

  const input = parsed.data;

  try {
    const url = normalizeAuditUrl(input.rawUrl);
    const result = await executeAuditSynchronously({
      rawUrl: input.rawUrl,
      auditType: "public",
      tenantId: null,
      businessName: input.businessName ?? null,
      contactName: input.contactName ?? null,
      contactEmail: input.contactEmail?.trim() || null,
      city: input.city ?? null,
      source: "marketing",
      utmSource: input.utmSource ?? null,
      utmMedium: input.utmMedium ?? null,
      utmCampaign: input.utmCampaign ?? null,
    });

    const pipelineLeadId = await createPipelineLeadForAudit({
      businessName: input.businessName ?? null,
      contactName: input.contactName ?? null,
      contactEmail: input.contactEmail?.trim() || null,
      normalizedUrl: url.normalizedUrl,
      normalizedDomain: url.normalizedDomain,
      overallScore: result.overallScore,
    });

    if (pipelineLeadId) {
      await linkAuditRequestToPipeline(result.requestId, pipelineLeadId);
    }

    return withPublicAuditCors(
      request,
      NextResponse.json({
        token: result.publicAccessToken,
        runId: result.runId,
        status: result.status,
        overallScore: result.overallScore,
        summary: result.summary,
      }),
    );
  } catch (error) {
    if (error instanceof UrlValidationError) {
      return withPublicAuditCors(
        request,
        NextResponse.json({ error: error.message }, { status: 400 }),
      );
    }

    const message = error instanceof Error ? error.message : "Audit failed.";
    return withPublicAuditCors(
      request,
      NextResponse.json({ error: message }, { status: 500 }),
    );
  }
}
