import type { SearchVisibilityQuery } from "./types";

const STOP_WORDS = new Set(["home", "about", "contact", "learn more", "click here", "read more", "our services", "services", "menu"]);

function cleanService(value: string): string | null {
  const cleaned = value.replace(/\s+/g, " ").replace(/[|•·]/g, " ").trim();
  if (cleaned.length < 4 || cleaned.length > 60) return null;
  if (STOP_WORDS.has(cleaned.toLowerCase())) return null;
  if (/^(get started|book now|contact us|call now|learn more)$/i.test(cleaned)) return null;
  return cleaned;
}

export function generateSearchQueries(input: {
  businessName: string | null;
  city: string | null;
  state?: string | null;
  services: string[];
}): SearchVisibilityQuery[] {
  const location = [input.city, input.state].filter(Boolean).join(" ").trim();
  const queries: SearchVisibilityQuery[] = [];
  const seen = new Set<string>();
  const add = (query: string, type: SearchVisibilityQuery["type"], service: string | null) => {
    const normalized = query.replace(/\s+/g, " ").trim();
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key) || normalized.length > 100) return;
    seen.add(key);
    queries.push({ query: normalized, type, service });
  };

  if (input.businessName) {
    add(input.businessName, "branded", null);
    if (location) add(`${input.businessName} ${location}`, "branded", null);
  }

  const services = [...new Set(input.services.map(cleanService).filter((value): value is string => Boolean(value)))].slice(0, 8);
  for (const service of services) {
    if (location) add(`${service} ${location}`, "discovery", service);
  }

  return queries.slice(0, 10);
}
