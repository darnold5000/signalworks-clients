import type { SearchVisibilityQuery } from "./types";
import { selectSearchProfile, type SearchProfile } from "@/lib/audit/search-profiles";

const NON_COMMERCIAL_PATTERNS = [
  /^home$/i,
  /^about(?: us)?$/i,
  /^our team$/i,
  /^meet (?:our )?people$/i,
  /^contact(?: us)?$/i,
  /^careers?$/i,
  /^privacy(?: policy)?$/i,
  /^disclosures?$/i,
  /^important disclosure information$/i,
  /^terms(?: (?:of )?use)?$/i,
  /^our fees?$/i,
  /^fees?$/i,
  /^foundations?$/i,
  /^login$/i,
  /^portal$/i,
  /^resources?$/i,
  /^blogs?$/i,
  /^news$/i,
  /^our services?$/i,
  /^services?$/i,
  /^(?:learn|read) more$/i,
  /^(?:get started|book now|contact us|call now)$/i,
];

const COMMERCIAL_INTENT = /\b(?:advisor|advisory|accounting|agency|attorney|consulting|counseling|financial|insurance|investment|law|management|marketing|mortgage|planning|retirement|therapy|training|wealth)\b/i;
const MARKETING_COPY = /(?:\bwithout\b|\bpricing\b|\bsolutions?\b|\bfor your\b|\bwe\b|\byour\b|\bwe believe\b|[,.;:!?])/i;

const FINANCIAL_DISCOVERY_QUERIES = [
  ["wealth management", null],
  ["financial advisor", null],
  ["financial planner", null],
  ["retirement planning", "retirement"],
  ["retirement advisor", "retirement"],
  ["investment management", "investment"],
  ["business retirement plans", "business retirement"],
  ["wealth advisor", null],
] as const;

function containsBusinessName(value: string, businessName: string | null | undefined) {
  const brandTokens = businessName?.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((token) => token.length > 2) ?? [];
  const normalized = value.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
  return brandTokens.length > 0 && brandTokens.every((token) => normalized.includes(token));
}

function cleanPhrase(value: string, businessName?: string | null): string | null {
  const cleaned = value.replace(/\s+/g, " ").replace(/[|•·]/g, " ").trim();
  if (cleaned.length < 4 || cleaned.length > 60) return null;
  if (NON_COMMERCIAL_PATTERNS.some((pattern) => pattern.test(cleaned))) return null;
  if (MARKETING_COPY.test(cleaned)) return null;
  if (/^(?:our|the)\s+(?:people|team|story|approach|process|fees|resources|foundations?)$/i.test(cleaned)) return null;
  if (/\b(?:privacy|disclosure|legal|copyright|login|portal|career|careers|news|blog)\b/i.test(cleaned)) return null;
  if (containsBusinessName(cleaned, businessName)) return null;
  return cleaned;
}

function isCommercialPhrase(value: string) {
  return COMMERCIAL_INTENT.test(value) && !/\b(?:information|page|overview|resources?)\b/i.test(value);
}

function looksFinancial(values: string[]) {
  return /\b(?:wealth|financial|retirement|investment|401\s*k|fiduciary|portfolio|asset management)\b/i.test(values.join(" "));
}

function normalizeLocation(city: string | null, state?: string | null) {
  return [city, state].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export function generateSearchQueries(input: {
  businessName: string | null;
  businessTypeHint?: string | null;
  city: string | null;
  state?: string | null;
  services: string[];
  profile?: SearchProfile;
}): SearchVisibilityQuery[] {
  const location = normalizeLocation(input.city, input.state);
  const queries: SearchVisibilityQuery[] = [];
  const seen = new Set<string>();
  const add = (query: string, type: SearchVisibilityQuery["type"], service: string | null, relevanceTier?: 1 | 2 | 3 | 4) => {
    const normalized = query.replace(/\s+/g, " ").trim();
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key) || normalized.length > 100) return;
    seen.add(key);
    queries.push({ query: normalized, type, service, relevanceTier });
  };

  if (input.businessName) {
    add(input.businessName, "branded", null);
    if (location) add(`${input.businessName} ${location}`, "branded", null);
  }

  const validServices = [...new Set(input.services.map((value) => cleanPhrase(value, input.businessName)).filter((value): value is string => Boolean(value)).filter(isCommercialPhrase))];
  const profile = input.profile ?? selectSearchProfile({ businessName: input.businessName, businessTypeHint: input.businessTypeHint, services: input.services });
  if (looksFinancial(validServices) || profile.key === "financial_advisor") {
    for (const [phrase, service] of FINANCIAL_DISCOVERY_QUERIES) {
      if (location) add(`${phrase} ${location}`, "discovery", service);
    }
  } else {
    const discoveryTerms = validServices.length >= 2 ? validServices : [...profile.baseTerms, ...validServices];
    const primaryVariants = profile.primaryServiceVariants ?? [];
    for (const service of [...new Set(primaryVariants)]) {
      if (location) add(`${service} ${location}`, "discovery", service, primaryVariants.indexOf(service) === 0 ? 1 : 2);
    }
    for (const service of [...new Set(discoveryTerms)].filter((term) => !primaryVariants.includes(term)).slice(0, 8)) {
      if (location) add(`${service} ${location}`, "discovery", service, validServices.includes(service) ? 3 : 4);
    }
  }

  return queries.slice(0, 10);
}

export function generateDiscoveryCandidates(input: { businessName: string | null; businessTypeHint?: string | null; city: string | null; state?: string | null; services: string[]; profile?: SearchProfile }): SearchVisibilityQuery[] {
  const location = normalizeLocation(input.city, input.state);
  const profile = input.profile ?? selectSearchProfile({ businessName: input.businessName, businessTypeHint: input.businessTypeHint, services: input.services });
  const validServices = input.services.map((value) => cleanPhrase(value, input.businessName)).filter((value): value is string => Boolean(value)).filter(isCommercialPhrase);
  const primaryVariants = profile.primaryServiceVariants ?? [];
  const terms = [...primaryVariants, ...validServices.filter((term) => !primaryVariants.includes(term)).map((term) => term), ...profile.baseTerms.filter((term) => !primaryVariants.includes(term))];
  const seen = new Set<string>();
  return terms.map((term) => term.replace(/\s+/g, " ").trim()).filter((term) => {
    const query = `${term} ${location}`.trim();
    const key = query.toLowerCase();
    if (!location || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((term, index) => ({ query: `${term} ${location}`.trim(), type: "discovery" as const, service: term, relevanceTier: index < primaryVariants.length ? (index === 0 ? 1 : 2) : validServices.includes(term) ? 3 : 4 }));
}

export { cleanPhrase as cleanSearchIntentPhrase };
