import type {
  PlatformPlanTemplate,
  PlatformProductCatalogItem,
} from "@/lib/catalog/types";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

export async function getActivePlanTemplates(): Promise<PlatformPlanTemplate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLES.platformPlanTemplates)
    .select(
      "id, plan_key, name, description, default_price_cents, billing_interval, sort_order, is_active",
    )
    .eq("is_active", true)
    .order("sort_order")
    .order("name");

  if (error) {
    console.error("getActivePlanTemplates", error.message);
    return [];
  }

  return (data ?? []) as PlatformPlanTemplate[];
}

export async function getActiveProductCatalog(): Promise<
  PlatformProductCatalogItem[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLES.platformProductCatalog)
    .select(
      "id, product_key, name, description, category, sort_order, is_active, is_paid_add_on, default_add_on_price_cents",
    )
    .eq("is_active", true)
    .order("sort_order")
    .order("name");

  if (error) {
    console.error("getActiveProductCatalog", error.message);
    return [];
  }

  return (data ?? []) as PlatformProductCatalogItem[];
}

export async function getPlanTemplateByKey(
  planKey: string,
): Promise<PlatformPlanTemplate | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from(TABLES.platformPlanTemplates)
    .select(
      "id, plan_key, name, description, default_price_cents, billing_interval, sort_order, is_active",
    )
    .eq("plan_key", planKey)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("getPlanTemplateByKey", error.message);
    return null;
  }

  return data as PlatformPlanTemplate;
}

export async function getProductsByKeys(
  productKeys: string[],
): Promise<PlatformProductCatalogItem[]> {
  if (productKeys.length === 0) return [];

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from(TABLES.platformProductCatalog)
    .select(
      "id, product_key, name, description, category, sort_order, is_active, is_paid_add_on, default_add_on_price_cents",
    )
    .in("product_key", productKeys)
    .eq("is_active", true);

  if (error) {
    console.error("getProductsByKeys", error.message);
    return [];
  }

  return (data ?? []) as PlatformProductCatalogItem[];
}

export async function getPaidAddOnsByKeys(
  productKeys: string[],
): Promise<PlatformProductCatalogItem[]> {
  if (productKeys.length === 0) return [];

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from(TABLES.platformProductCatalog)
    .select(
      "id, product_key, name, description, category, sort_order, is_active, is_paid_add_on, default_add_on_price_cents",
    )
    .in("product_key", productKeys)
    .eq("is_active", true)
    .eq("is_paid_add_on", true);

  if (error) {
    console.error("getPaidAddOnsByKeys", error.message);
    return [];
  }

  return (data ?? []) as PlatformProductCatalogItem[];
}
