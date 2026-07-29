import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { logTenantActivity } from "@/lib/activity/log-tenant-activity";
import {
  inviteErrorPath,
  mapVerifyOtpFailureToReason,
  resolveInviteNextPath,
} from "@/lib/auth/branded-invite-flow";
import { afterInviteOtpVerified } from "@/lib/auth/confirm-invite-post-verify";
import { getPortalInviteAccessForUser } from "@/lib/auth/portal-invite-access";
import { supabaseServerAuthOptions } from "@/lib/supabase/auth-options";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/server";

function redirectOnResponse(
  response: NextResponse,
  target: URL,
): NextResponse {
  response.headers.set("Location", target.toString());
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash")?.trim();
  const type = searchParams.get("type")?.trim();
  const next = resolveInviteNextPath(searchParams.get("next"));

  if (!tokenHash) {
    return NextResponse.redirect(
      new URL(inviteErrorPath("missing-token"), origin),
    );
  }

  if (type !== "invite") {
    return NextResponse.redirect(
      new URL(inviteErrorPath("invalid-link"), origin),
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return NextResponse.redirect(
      new URL(inviteErrorPath("invalid-link"), origin),
    );
  }

  const successTarget = new URL(next, origin);
  let response = NextResponse.redirect(successTarget);

  const supabase = createServerClient(url, anonKey, {
    ...supabaseServerAuthOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.signOut();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "invite",
  });

  if (verifyError) {
    await supabase.auth.signOut();
    console.error(
      "[auth/confirm-invite] verifyOtp",
      mapVerifyOtpFailureToReason(verifyError.message),
    );
    return redirectOnResponse(
      response,
      new URL(
        inviteErrorPath(mapVerifyOtpFailureToReason(verifyError.message)),
        origin,
      ),
    );
  }

  const postVerify = await afterInviteOtpVerified({
    getUser: () => supabase.auth.getUser(),
    signOut: () => supabase.auth.signOut(),
    resolvePortalAccess: async (userId) => {
      if (!isServiceRoleConfigured()) {
        return { ok: true, tenantId: "" };
      }
      const admin = createServiceClient();
      return getPortalInviteAccessForUser(admin, userId);
    },
    onLinkVerified:
      isServiceRoleConfigured()
        ? async (tenantId, userId) => {
            await logTenantActivity({
              tenantId,
              actorUserId: userId,
              actorType: "user",
              action: "invite.link_verified",
              entityType: "user",
              entityId: userId,
              summary: "Client opened branded invite link",
            });
          }
        : undefined,
  });

  if (postVerify.kind === "failure") {
    return redirectOnResponse(
      response,
      new URL(inviteErrorPath(postVerify.reason), origin),
    );
  }

  return response;
}
