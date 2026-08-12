export type SearchProfile = {
  key: string;
  applicable: boolean;
  baseTerms: string[];
  hintDisagreed?: boolean;
};

const PROFILES: Array<SearchProfile & { signals: RegExp }> = [
  { key: "financial_advisor", signals: /wealth|financial|retirement|investment|fiduciary|portfolio/i, applicable: true, baseTerms: ["financial advisor", "financial planner", "wealth management", "wealth advisor", "retirement planning", "retirement advisor", "investment management", "investment advisor", "financial planning", "401k advisor", "business retirement plans", "retirement income planning", "wealth planning"] },
  { key: "dentist", signals: /dentist|dental|invisalign/i, applicable: true, baseTerms: ["dentist", "family dentist", "cosmetic dentist", "dental office", "emergency dentist"] },
  { key: "fitness_gym", signals: /gym|fitness|personal training|strength training/i, applicable: true, baseTerms: ["gym", "fitness center", "personal trainer", "strength training", "fitness classes"] },
  { key: "sports_training", signals: /basketball|sports performance|athletic|speed and agility|youth sports/i, applicable: true, baseTerms: ["sports performance training", "athletic training", "speed and agility training", "youth sports training", "strength training"] },
  { key: "coffee_shop", signals: /coffee|cafe|espresso/i, applicable: true, baseTerms: ["coffee shop", "coffee", "cafe", "espresso"] },
  { key: "restaurant", signals: /restaurant|menu|dining|cuisine/i, applicable: true, baseTerms: ["restaurant", "restaurant near me", "local dining"] },
  { key: "salon", signals: /salon|hair|nail|barber/i, applicable: true, baseTerms: ["hair salon", "hair stylist", "nail salon", "barber"] },
  { key: "web_services", signals: /web ?design|website|web ?development|software ?development|digital ?agency|agency/i, applicable: true, baseTerms: ["web design", "website designer", "web development", "small business website design", "custom website development", "software development", "business software development", "web design company"] },
  { key: "professional_services", signals: /advisor|consult|accounting|attorney|contractor|landscap|mortgage|insurance|therapy/i, applicable: true, baseTerms: [] },
];

function profileForSource(source: string) {
  if (/\b(?:saas|software platform|ecommerce|e-commerce|online only|national publication|nationwide)\b/i.test(source)) return { key: "not_applicable", applicable: false, baseTerms: [] } satisfies SearchProfile;
  return PROFILES.find((profile) => profile.signals.test(source)) ?? null;
}

function normalizeHint(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/[&/,]+/g, " ").replace(/\s+/g, " ") ?? "";
}

export function normalizeBusinessTypeHint(value: string | null | undefined) {
  return normalizeHint(value);
}

export function selectSearchProfile(input: { businessName: string | null; services: string[]; businessTypeHint?: string | null; content?: string }): SearchProfile {
  // Profile selection must use this audit's business identity and validated
  // service intents only. Homepage copy is not an industry classification
  // source and can mention unrelated industries.
  const serviceSource = input.services.filter((service) => !/(?:without|pricing|[,.;:!?])/i.test(service)).join(" ");
  const websiteProfile = profileForSource(serviceSource);
  const hintProfile = profileForSource(normalizeHint(input.businessTypeHint));
  if (websiteProfile && hintProfile && websiteProfile.key !== hintProfile.key) {
    console.warn("[audit/search-profile] business type disagrees with website services", { websiteProfile: websiteProfile.key, hintProfile: hintProfile.key });
    return { ...websiteProfile, hintDisagreed: true };
  }
  const selected = websiteProfile ?? hintProfile;
  if (selected) return { key: selected.key, applicable: selected.applicable, baseTerms: selected.baseTerms };
  if (input.services.length > 0) return { key: "generic_local_business", applicable: true, baseTerms: [] };
  return { key: "not_applicable", applicable: false, baseTerms: [] };
}

export function selectLocalQueryTerms(input: { discoveryQueries: string[]; profile: SearchProfile }): string[] {
  const normalized = input.discoveryQueries.map((query) => query.trim()).filter(Boolean);
  const base = input.profile.baseTerms;
  return [...new Set([
    ...base.filter((term) => normalized.some((query) => query.toLowerCase().startsWith(term.toLowerCase()))),
    ...normalized,
    ...base,
  ])].slice(0, 5);
}
