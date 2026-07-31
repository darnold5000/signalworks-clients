export function extractTitle(html: string): string | null {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match ? decodeHtmlEntities(stripTags(match[1]).trim()) : null;
}

export function extractMetaContent(html: string, nameOrProperty: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:name|property)=["']${escapeRegExp(nameOrProperty)}["'][^>]+content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escapeRegExp(nameOrProperty)}["']`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) {
      return decodeHtmlEntities(match[1].trim());
    }
  }

  return null;
}

export function extractCanonicalUrl(html: string): string | null {
  const match =
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i.exec(html) ??
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i.exec(html);
  return match?.[1]?.trim() ?? null;
}

export function extractHtmlLang(html: string): string | null {
  const match = /<html[^>]+lang=["']([^"']+)["']/i.exec(html);
  return match?.[1]?.trim() ?? null;
}

export function countMatches(html: string, pattern: RegExp): number {
  return [...html.matchAll(pattern)].length;
}

export function extractHeadings(html: string, level: 1 | 2 | 3): string[] {
  const pattern = new RegExp(`<h${level}[^>]*>([\\s\\S]*?)<\\/h${level}>`, "gi");
  const headings: string[] = [];
  for (const match of html.matchAll(pattern)) {
    const text = stripTags(match[1]).replace(/\s+/g, " ").trim();
    if (text) headings.push(text);
  }
  return headings;
}

export function extractLinks(html: string): Array<{ href: string; text: string }> {
  const links: Array<{ href: string; text: string }> = [];
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const href = match[1]?.trim();
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;
    links.push({
      href,
      text: stripTags(match[2]).replace(/\s+/g, " ").trim(),
    });
  }
  return links;
}

export function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const pattern =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(pattern)) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        blocks.push(...parsed);
      } else {
        blocks.push(parsed);
      }
    } catch {
      // Skip invalid JSON-LD blocks.
    }
  }

  return blocks;
}

export function visibleTextIncludes(html: string, needles: string[]): boolean {
  const text = stripTags(html).toLowerCase();
  return needles.some((needle) => text.includes(needle.toLowerCase()));
}

export function countImagesMissingAlt(html: string): { total: number; missingAlt: number } {
  const images = [...html.matchAll(/<img\b[^>]*>/gi)];
  let missingAlt = 0;
  for (const match of images) {
    const tag = match[0];
    if (!/\balt=["'][^"']+["']/i.test(tag)) {
      missingAlt += 1;
    }
  }
  return { total: images.length, missingAlt };
}

export function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
