export type SearchProfile = {
  key: string;
  applicable: boolean;
  baseTerms: string[];
  primaryService?: string | null;
  primaryServiceVariants?: string[];
  hintDisagreed?: boolean;
};

const PROFILES: Array<SearchProfile & { signals: RegExp }> = [
  { key: "financial_advisor", signals: /wealth|financial|retirement|investment|fiduciary|portfolio/i, applicable: true, baseTerms: ["financial advisor", "financial planner", "wealth management", "wealth advisor", "retirement planning", "retirement advisor", "investment management", "investment advisor", "financial planning", "401k advisor", "business retirement plans", "retirement income planning", "wealth planning"] },
  { key: "dentist", signals: /dentist|dental|invisalign/i, applicable: true, baseTerms: ["dentist", "family dentist", "cosmetic dentist", "dental office", "emergency dentist"] },
  { key: "sports_training", signals: /basketball|baseball|soccer|football|volleyball|tennis|softball|hockey|golf|lacrosse|wrestling|swimming|track|sports performance|athletic|speed and agility|youth sports/i, applicable: true, baseTerms: ["sports performance training", "athletic training", "speed and agility training", "youth sports training", "strength training"] },
  { key: "fitness_gym", signals: /gym|fitness|personal training|strength training/i, applicable: true, baseTerms: ["gym", "fitness center", "personal trainer", "strength training", "fitness classes"] },
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

const SPECIFIC_SPORTS = ["basketball", "baseball", "soccer", "football", "volleyball", "tennis", "softball", "hockey", "golf", "lacrosse", "wrestling", "swimming", "track"];

function derivePrimaryService(source: string, profileKey: string): { primaryService: string | null; variants: string[] } {
  const normalized = source.replace(/[|•·]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  if (profileKey === "sports_training") {
    const sport = SPECIFIC_SPORTS.find((candidate) => new RegExp(`\\b${candidate}\\b`, "i").test(normalized));
    if (sport) {
      return {
        primaryService: `${sport} training`,
        variants: [`${sport} training`, `${sport} trainer`, `${sport} skills training`, `youth ${sport} training`, `${sport} lessons`],
      };
    }
  }
  if (profileKey === "dentist" && /dentist|dental/i.test(normalized)) return { primaryService: "dentist", variants: ["dentist", "family dentist", "cosmetic dentist"] };
  if (profileKey === "fitness_gym" && /personal training/i.test(normalized)) return { primaryService: "personal training", variants: ["personal training", "personal trainer", "fitness training"] };
  if (profileKey === "web_services" && /web ?design/i.test(normalized)) return { primaryService: "web design", variants: ["web design", "website designer", "web design company"] };
  if (profileKey === "financial_advisor" && /financial planning|financial advisor|wealth management/i.test(normalized)) return { primaryService: "financial planning", variants: ["financial planning", "financial advisor", "wealth management"] };
  return { primaryService: null, variants: [] };
}

function enrichProfile(profile: SearchProfile, source: string): SearchProfile {
  const primary = derivePrimaryService(source, profile.key);
  return { ...profile, primaryService: primary.primaryService, primaryServiceVariants: primary.variants };
}

function normalizeHint(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/[&/,]+/g, " ").replace(/\s+/g, " ") ?? "";
}

export function normalizeBusinessTypeHint(value: string | null | undefined) {
  return normalizeHint(value);
}

export function getSearchProfileByKey(key: string | null | undefined): SearchProfile | null {
  if (!key) return null;
  const profile = PROFILES.find((candidate) => candidate.key === key);
  return profile ? enrichProfile(profile, "") : key === "generic_local_business" ? { key, applicable: true, baseTerms: [], primaryService: null, primaryServiceVariants: [] } : key === "not_applicable" ? { key, applicable: false, baseTerms: [], primaryService: null, primaryServiceVariants: [] } : null;
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
    return { ...enrichProfile(websiteProfile, serviceSource), hintDisagreed: true };
  }
  const selected = websiteProfile ?? hintProfile;
  if (selected) return enrichProfile({ key: selected.key, applicable: selected.applicable, baseTerms: selected.baseTerms }, serviceSource || normalizeHint(input.businessTypeHint));
  if (input.services.length > 0) return { key: "generic_local_business", applicable: true, baseTerms: [], primaryService: null, primaryServiceVariants: [] };
  return { key: "not_applicable", applicable: false, baseTerms: [], primaryService: null, primaryServiceVariants: [] };
}

export function selectLocalQueryTerms(input: { discoveryQueries: Array<string | { query: string; relevanceTier?: 1 | 2 | 3 | 4 }>; profile: SearchProfile }): string[] {
  const normalized = input.discoveryQueries
    .map((item) => typeof item === "string" ? { query: item, relevanceTier: 99 } : { query: item.query, relevanceTier: item.relevanceTier ?? 99 })
    .map((item) => ({ ...item, query: item.query.trim() }))
    .filter((item) => item.query && item.relevanceTier !== 4)
    .sort((a, b) => a.relevanceTier - b.relevanceTier);
  return [...new Set(normalized.map((item) => item.query))].slice(0, 5);
}
