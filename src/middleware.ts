import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/no-access",
    "/auth/:path*",
    "/overview/:path*",
    "/requests/:path*",
    "/billing/:path*",
    "/documents/:path*",
    "/support/:path*",
    "/admin/:path*",
  ],
};
