import { extractHeadings, extractJsonLdBlocks, extractLinks, extractTitle, stripTags } from "@/lib/audit/collectors/shared/html-parse";

const STOPWORDS = new Set(["a", "an", "the", "and", "or", "of", "for", "in", "to", "with", "your", "our", "we", "you", "at", "on", "from", "by", "is", "are", "was", "be", "this", "that", "it", "its", "as", "if", "not", "no", "all", "can", "will", "just", "more", "than", "into", "over", "also", "about", "us", "me", "my", "amp"]);

export const FORMAT_MODIFIERS = new Set(["class", "classes", "lesson", "lessons", "training", "program", "programs", "service", "services", "near", "course", "courses", "session", "sessions"]);
export const AUDIENCE_MODIFIERS = new Set(["kid", "kids", "child", "children", "youth", "preschool", "toddler", "toddlers", "adult", "adults", "family", "beginner", "beginners"]);
export const ROLE_MODIFIERS = new Set(["teacher", "instructor", "coach", "trainer", "academy", "school", "studio", "clinic", "office", "company", "shop"]);
export const QUALITY_JUNK = new Set(["best", "top", "cheap", "affordable", "local", "nearby", "online"]);

const NAV_JUNK = /^(home|about|contact|privacy|terms|login|careers?|blog|news|menu|services|our services)$/i;

export type WebsiteEvidence = {
  title: string | null;
  h1: string[];
  headings: string[];
  navPhrases: string[];
  schemaPhrases: string[];
  bodyTokens: Set<string>;
  allTokens: Set<string>;
  primaryTokens: Set<string>;
  phrases: string[];
};

export function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

export function stemToken(token: string): string {
  if (token.length < 5) return token;
  if (token.endsWith("ies") && token.length > 5) return `${token.slice(0, -3)}y`;
  if (token.endsWith("es") && token.length > 5) return token.slice(0, -2);
  if (token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  if (token.endsWith("ing") && token.length > 6) return token.slice(0, -3);
  if (token.endsWith("er") && token.length > 5) return token.slice(0, -2);
  return token;
}

export function stemmedSet(tokens: Iterable<string>): Set<string> {
  return new Set([...tokens].map(stemToken));
}

function phraseFromPath(href: string): string | null {
  try {
    const path = href.startsWith("http") ? new URL(href).pathname : href;
    const last = path.split("/").filter(Boolean).at(-1);
    if (!last || last.includes(".")) return null;
    const phrase = decodeURIComponent(last).replace(/[-_]+/g, " ").trim();
    return phrase.length >= 4 && phrase.length <= 60 ? phrase : null;
  } catch {
    return null;
  }
}

function schemaPhrasesFromValue(value: unknown, phrases: string[]) {
  if (!value) return;
  if (typeof value === "string") {
    const cleaned = value.replace(/\s+/g, " ").trim();
    if (cleaned.length >= 3 && cleaned.length <= 120) phrases.push(cleaned);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => schemaPhrasesFromValue(item, phrases));
    return;
  }
  if (typeof value !== "object") return;
  const node = value as Record<string, unknown>;
  for (const key of ["name", "description", "serviceType", "category", "alternateName"]) {
    schemaPhrasesFromValue(node[key], phrases);
  }
  schemaPhrasesFromValue(node["@graph"], phrases);
  schemaPhrasesFromValue(node.hasOfferCatalog, phrases);
  schemaPhrasesFromValue(node.itemListElement, phrases);
  schemaPhrasesFromValue(node.makesOffer, phrases);
}

function tokenCounts(phrases: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const phrase of phrases) {
    for (const token of tokenize(phrase)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return counts;
}

export function extractWebsiteEvidence(html: string | null | undefined): WebsiteEvidence {
  if (!html) {
    return { title: null, h1: [], headings: [], navPhrases: [], schemaPhrases: [], bodyTokens: new Set(), allTokens: new Set(), primaryTokens: new Set(), phrases: [] };
  }

  const title = extractTitle(html);
  const h1 = extractHeadings(html, 1);
  const headings = [...extractHeadings(html, 2), ...extractHeadings(html, 3)];
  const links = extractLinks(html);
  const navPhrases = [...new Set(links.flatMap((link) => {
    const fromText = link.text.replace(/\s+/g, " ").trim();
    const fromPath = phraseFromPath(link.href);
    return [fromText, fromPath].filter((value): value is string => typeof value === "string" && value.length >= 4 && value.length <= 60 && !NAV_JUNK.test(value));
  }))];
  const schemaPhrases: string[] = [];
  extractJsonLdBlocks(html).forEach((block) => schemaPhrasesFromValue(block, schemaPhrases));

  const visible = stripTags(html).replace(/\s+/g, " ").trim().toLowerCase();
  const bodyTokens = new Set(tokenize(visible).filter((token) => {
    const pattern = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    return (visible.match(pattern) ?? []).length >= 2;
  }));

  const phrases = [...new Set([title, ...h1, ...headings, ...navPhrases, ...schemaPhrases].filter((value): value is string => Boolean(value)))];
  const allTokens = new Set([...phrases.flatMap(tokenize), ...bodyTokens]);
  const primaryPhrases = [title, ...h1, ...schemaPhrases.slice(0, 8)].filter((value): value is string => Boolean(value));
  const headingCounts = tokenCounts([...h1, ...headings]);
  const primaryTokens = new Set([
    ...primaryPhrases.flatMap(tokenize),
    ...[...headingCounts.entries()].filter(([, count]) => count >= 2).map(([token]) => token),
  ]);

  return { title, h1, headings, navPhrases, schemaPhrases, bodyTokens, allTokens, primaryTokens, phrases };
}

export function evidenceSeedPhrases(evidence: WebsiteEvidence, limit = 20): string[] {
  const preferred = [...evidence.h1, ...evidence.headings, evidence.title, ...evidence.schemaPhrases, ...evidence.navPhrases]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.replace(/\s+/g, " ").trim().toLowerCase())
    .filter((value) => value.length >= 4 && value.length <= 60 && !NAV_JUNK.test(value));
  return [...new Set(preferred)].slice(0, limit);
}
