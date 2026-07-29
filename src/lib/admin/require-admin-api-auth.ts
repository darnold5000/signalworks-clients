import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { PERMISSIONS } from "@/lib/permissions";
import { createClientFromRequest } from "@/lib/supabase/server";

export function jsonWithSessionCookies(
  sessionCookies: NextResponse,
  body: Record<string, unknown>,
  init?: ResponseInit,
): NextResponse {
  const response = NextResponse.json(body, init);
  for (const cookie of sessionCookies.cookies.getAll()) {
    response.cookies.set(cookie);
  }
  return response;
}

export async function userHasAnyPlatformPermission(
  supabase: SupabaseClient,
  permissions: string[],
): Promise<boolean> {
  for (const permissionName of permissions) {
    const { data, error } = await supabase.rpc("has_platform_permission", {
      permission_name: permissionName,
    });
    if (error) {
      console.error(
        "[require-admin-api-auth] has_platform_permission",
        permissionName,
        error.message,
      );
      continue;
    }
    if (data) return true;
  }
  return false;
}

export type AdminApiAuthSuccess = {
  ok: true;
  userId: string;
  supabase: SupabaseClient;
  sessionCookies: NextResponse;
};

export type AdminApiAuthFailure = {
  ok: false;
  response: NextResponse;
};

export async function requireAdminApiAuth(
  request: NextRequest,
  permissions: string[] = [PERMISSIONS.manageTenants],
): Promise<AdminApiAuthSuccess | AdminApiAuthFailure> {
  const sessionCookies = NextResponse.next({ request });
  const supabase = createClientFromRequest(request, sessionCookies);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      response: jsonWithSessionCookies(
        sessionCookies,
        { error: "Unauthorized" },
        { status: 401 },
      ),
    };
  }

  const allowed = await userHasAnyPlatformPermission(supabase, permissions);
  if (!allowed) {
    return {
      ok: false,
      response: jsonWithSessionCookies(
        sessionCookies,
        { error: "Unauthorized" },
        { status: 401 },
      ),
    };
  }

  return { ok: true, userId: user.id, supabase, sessionCookies };
}

export const TECHNICAL_PROFILE_ADMIN_PERMISSIONS = [
  PERMISSIONS.manageTenants,
  PERMISSIONS.manageClientTechnicalDetails,
] as const;
