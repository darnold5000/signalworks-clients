export const PLAN_KEYS = [
  "personal-brand",
  "launch-website",
  "growth-website",
  "founding-client",
] as const;

export type PlanKey = (typeof PLAN_KEYS)[number];

export type PlanConfig = {
  key: PlanKey;
  name: string;
  monthlyPriceCents: number;
  description: string;
  envVar: string;
};

export const PLANS: PlanConfig[] = [
  {
    key: "personal-brand",
    name: "Personal Brand",
    monthlyPriceCents: 2499,
    description: "One-page professional website with hosting and support.",
    envVar: "STRIPE_PRICE_PERSONAL_BRAND",
  },
  {
    key: "launch-website",
    name: "Launch Website",
    monthlyPriceCents: 4900,
    description: "3–5 page website with hosting, updates, and support.",
    envVar: "STRIPE_PRICE_LAUNCH",
  },
  {
    key: "growth-website",
    name: "Growth Website",
    monthlyPriceCents: 9900,
    description: "Growth site with priority support and ongoing improvements.",
    envVar: "STRIPE_PRICE_GROWTH",
  },
  {
    key: "founding-client",
    name: "Founding Client",
    monthlyPriceCents: 2500,
    description: "Introductory founding-client website and support plan.",
    envVar: "STRIPE_PRICE_FOUNDING_CLIENT",
  },
];

export function getPlan(key: string): PlanConfig | undefined {
  return PLANS.find((p) => p.key === key);
}

export function getPriceIdForPlan(key: PlanKey): string | null {
  const plan = getPlan(key);
  if (!plan) return null;
  const priceId = process.env[plan.envVar];
  return priceId || null;
}

export function getPlanKeyFromPriceId(priceId: string): PlanKey | null {
  for (const plan of PLANS) {
    if (process.env[plan.envVar] === priceId) return plan.key;
  }
  return null;
}

/** Match a client's plan_name (or stripe price) to a catalog plan. */
export function resolvePlanForClient(input: {
  plan_name?: string | null;
  stripe_price_id?: string | null;
}): PlanConfig | null {
  if (input.stripe_price_id) {
    const fromPrice = getPlanKeyFromPriceId(input.stripe_price_id);
    if (fromPrice) return getPlan(fromPrice) ?? null;
  }

  const name = (input.plan_name ?? "").trim().toLowerCase();
  if (!name) return null;

  const aliases: Record<string, PlanKey> = {
    "personal brand": "personal-brand",
    "launch website": "launch-website",
    launch: "launch-website",
    "growth website": "growth-website",
    growth: "growth-website",
    "founding client": "founding-client",
    founding: "founding-client",
  };

  const key = aliases[name] ?? PLANS.find((p) => p.name.toLowerCase() === name)?.key;
  return key ? (getPlan(key) ?? null) : null;
}
