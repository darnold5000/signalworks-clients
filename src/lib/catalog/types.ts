export type PlatformPlanTemplate = {
  id: string;
  plan_key: string;
  name: string;
  description: string | null;
  default_price_cents: number;
  billing_interval: string;
  sort_order: number;
  is_active: boolean;
};

export type PlatformProductCatalogItem = {
  id: string;
  product_key: string;
  name: string;
  description: string | null;
  category: string | null;
  category_group: string | null;
  capabilities?: string[];
  sort_order: number;
  is_active: boolean;
  catalog_kind?: "platform_component" | "service_add_on";
  is_paid_add_on?: boolean;
  default_add_on_price_cents?: number | null;
  suggested_add_on_price_cents?: number | null;
  supports_quantity?: boolean;
};

export const CATALOG_VERSION = 2;
