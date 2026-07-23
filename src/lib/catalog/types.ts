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
  sort_order: number;
  is_active: boolean;
  is_paid_add_on?: boolean;
  default_add_on_price_cents?: number | null;
};

export const CATALOG_VERSION = 1;
