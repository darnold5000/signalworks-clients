export type SearchProfile = {
  key: string;
  applicable: boolean;
  baseTerms: string[];
};

const PROFILES: Array<SearchProfile & { signals: RegExp }> = [
  { key: "financial_advisor", signals: /wealth|financial|retirement|investment|fiduciary|portfolio/i, applicable: true, baseTerms: ["financial advisor", "wealth management", "financial planner", "retirement planning", "wealth advisor"] },
  { key: "dentist", signals: /dentist|dental|invisalign/i, applicable: true, baseTerms: ["dentist", "family dentist", "cosmetic dentist", "dental office", "emergency dentist"] },
  { key: "fitness_gym", signals: /gym|fitness|personal training|strength training/i, applicable: true, baseTerms: ["gym", "fitness center", "personal trainer", "strength training", "fitness classes"] },
  { key: "sports_training", signals: /sports performance|athletic|speed and agility|youth sports/i, applicable: true, baseTerms: ["sports performance training", "athletic training", "speed and agility training", "youth sports training", "strength training"] },
  { key: "coffee_shop", signals: /coffee|cafe|espresso/i, applicable: true, baseTerms: ["coffee shop", "coffee", "cafe", "espresso"] },
  { key: "restaurant", signals: /restaurant|menu|dining|cuisine/i, applicable: true, baseTerms: ["restaurant", "restaurant near me", "local dining"] },
  { key: "salon", signals: /salon|hair|nail|barber/i, applicable: true, baseTerms: ["hair salon", "hair stylist", "nail salon", "barber"] },
  { key: "professional_services", signals: /advisor|consult|accounting|attorney|contractor|landscap|mortgage|insurance|therapy/i, applicable: true, baseTerms: [] },
];

export function selectSearchProfile(input: { businessName: string | null; services: string[]; content?: string }): SearchProfile {
  const source = [input.businessName ?? "", ...input.services, input.content ?? ""].join(" ");
  if (/\b(?:saas|software platform|ecommerce|e-commerce|online only|national publication|nationwide)\b/i.test(source)) {
    return { key: "not_applicable", applicable: false, baseTerms: [] };
  }
  const selected = PROFILES.find((profile) => profile.signals.test(source));
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
