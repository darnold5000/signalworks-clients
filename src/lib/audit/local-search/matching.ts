import { domainMatches } from "@/lib/audit/search-visibility/run";

function normalized(value: string) {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

export function localBusinessMatches(input: { item: { title?: string; domain?: string; url?: string }; businessName: string | null; targetDomain: string }): boolean {
  if (input.item.domain && domainMatches(`https://${input.item.domain}`, input.targetDomain)) return true;
  if (input.item.url && domainMatches(input.item.url, input.targetDomain)) return true;
  if (!input.businessName || !input.item.title) return false;
  const expected = normalized(input.businessName);
  const actual = normalized(input.item.title);
  return actual === expected;
}
