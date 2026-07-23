import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

export const getSignalWorksTenantId = cache(async (): Promise<string> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLES.tenants)
    .select("id")
    .eq("slug", "signalworks")
    .eq("platform_category", "internal")
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("getSignalWorksTenantId", error.message);
    throw new Error(
      "Signal Works internal tenant lookup failed. Contact your administrator.",
    );
  }

  if (!data?.id) {
    throw new Error(
      "Signal Works internal tenant is not configured. Contact your administrator.",
    );
  }

  return data.id;
});
