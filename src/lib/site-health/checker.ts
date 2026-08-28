import {
  extractCanonicalUrl,
  extractJsonLdBlocks,
  extractMetaContent,
  extractTitle,
} from "@/lib/audit/collectors/shared/html-parse";
import type { SafeFetchFn, SafeFetchResponse } from "@/lib/audit/types";
import { createSafeFetch } from "@/lib/audit/url/safe-fetch";
import { normalizeAuditUrl, UrlValidationError } from "@/lib/audit/url/normalize";
import type { SiteHealthCheck, SiteHealthResult } from "@/lib/site-health/types";

const FETCH_OPTIONS = { timeoutMs: 8_000, maxRedirects: 5, maxResponseBytes: 2_000_000 };

export type SiteHealthCheckerDependencies = { safeFetch?: SafeFetchFn; now?: () => Date };

export async function checkConfiguredSite(
  rawUrl: string,
  dependencies: SiteHealthCheckerDependencies = {},
): Promise<SiteHealthResult> {
  const started = Date.now();
  const now = dependencies.now ?? (() => new Date());
  const configured = normalizeAuditUrl(rawUrl);
  const rootHostname = configured.normalizedDomain;
  const primaryHostname = configured.hostname;
  const alternateHostname = primaryHostname.startsWith("www.")
    ? rootHostname
    : `www.${rootHostname}`;
  const origin = `${new URL(configured.normalizedUrl).protocol}//${primaryHostname}`;
  let resolvedSitemapUrl = `${origin}/sitemap.xml`;
  let sitemapUrlCount: number | null = null;
  let liveCanonicalUrl: string | null = null;
  const safeFetch = dependencies.safeFetch ?? createSafeFetch();
  const fetchOptions = {
    ...FETCH_OPTIONS,
    allowedHostnames: new Set([rootHostname, `www.${rootHostname}`]),
  };
  const checks: SiteHealthCheck[] = [];

  checks.push(primaryHostname.endsWith(".vercel.app")
    ? fail(
      "production_domain",
      "Production hostname",
      "A Vercel preview/hosting domain is configured as production.",
      "Configure the intended customer-facing production domain, or explicitly confirm this hostname is intentional.",
    )
    : pass("production_domain", "Production hostname", "A customer-facing hostname is configured."));

  let homepage: SafeFetchResponse;
  try {
    homepage = await fetchConfiguredHost(safeFetch, configured.normalizedUrl, rootHostname, fetchOptions);
  } catch (error) {
    checks.push(fail("reachability", "Domain and HTTPS", readableError(error), "Confirm DNS records, hosting, and the TLS certificate."));
    return result("error", null, checks);
  }

  checks.push({
    key: "reachability",
    label: "Domain and HTTPS",
    state: homepage.status >= 200 && homepage.status < 400 && new URL(homepage.finalUrl).protocol === "https:" ? "pass" : "fail",
    explanation: homepage.status >= 200 && homepage.status < 400 ? `Homepage responded with HTTP ${homepage.status}.` : `Homepage responded with HTTP ${homepage.status}.`,
    recommendation: new URL(homepage.finalUrl).protocol !== "https:" ? "Redirect the production site to HTTPS." : undefined,
    evidence: homepage.finalUrl,
  });

  const final = new URL(homepage.finalUrl);

  try {
    const httpUrl = `http://${primaryHostname}/`;
    const httpResponse = await fetchConfiguredHost(safeFetch, httpUrl, rootHostname, fetchOptions);
    const httpFinal = new URL(httpResponse.finalUrl);
    const permanent = isPermanentRedirectChain(httpResponse);
    checks.push(httpFinal.protocol === "https:" && httpFinal.hostname === final.hostname && permanent
      ? pass("http_https", "HTTP to HTTPS", "HTTP permanently resolves to the HTTPS primary URL.", httpResponse.redirectChain.join(" → "))
      : fail("http_https", "HTTP to HTTPS", permanent ? `HTTP resolves to ${httpResponse.finalUrl}.` : "HTTP does not use a permanent redirect to HTTPS.", "Permanently redirect HTTP to the HTTPS primary URL."));
  } catch (error) {
    checks.push(warn("http_https", "HTTP to HTTPS", readableError(error), "Permanently redirect HTTP to the HTTPS primary URL."));
  }

  const redirectsConsistent = final.hostname.replace(/^www\./, "") === rootHostname;
  checks.push(redirectsConsistent
    ? pass("redirects", "Redirects and primary hostname", `Requests resolve to ${final.hostname}.`, homepage.redirectChain.join(" → "))
    : fail("redirects", "Redirects and primary hostname", "The configured URL redirected outside its configured hostname pair.", "Choose one primary hostname and redirect the alternate hostname to it."));

  try {
    const alternateUrl = `${final.protocol}//${alternateHostname}/`;
    const alternate = await fetchConfiguredHost(safeFetch, alternateUrl, rootHostname, fetchOptions);
    const alternateFinal = new URL(alternate.finalUrl);
    checks.push(alternateFinal.hostname === final.hostname && isPermanentRedirectChain(alternate)
      ? pass("www", "Alternate www hostname", `${alternateHostname} resolves to the primary hostname.`, alternate.redirectChain.join(" → "))
      : warn("www", "Alternate www hostname", `${alternateHostname} does not permanently resolve to the same primary hostname.`, "Permanently redirect the alternate hostname to the canonical production hostname."));
  } catch (error) {
    checks.push(warn("www", "Alternate www hostname", `${alternateHostname} could not be verified: ${readableError(error)}`, "Configure the alternate hostname and redirect it to the primary hostname."));
  }

  const canonical = extractCanonicalUrl(homepage.bodyText);
  if (!canonical) {
    checks.push(fail("canonical", "Canonical URL", "The homepage has no canonical link.", "Add a self-referencing absolute canonical URL."));
  } else {
    try {
      const absoluteCanonical = new URL(canonical, homepage.finalUrl);
      liveCanonicalUrl = absoluteCanonical.toString();
      const canonicalValid = absoluteCanonical.protocol === "https:"
        && canonical.toLowerCase().startsWith("https://")
        && absoluteCanonical.hostname === final.hostname
        && !absoluteCanonical.hostname.endsWith(".vercel.app")
        && normalizePath(absoluteCanonical.pathname) === normalizePath(final.pathname);
      checks.push(canonicalValid
        ? pass("canonical", "Canonical URL", "The homepage canonical matches the final primary URL.", absoluteCanonical.toString())
        : fail("canonical", "Canonical URL", `The homepage canonical points to ${absoluteCanonical.toString()}.`, `Change the canonical to ${homepage.finalUrl}.`));
    } catch {
      checks.push(fail("canonical", "Canonical URL", `The homepage canonical is malformed: ${canonical}`, `Change the canonical to ${homepage.finalUrl}.`));
    }
  }

  const robotsMeta = extractMetaContent(homepage.bodyText, "robots")?.toLowerCase() ?? "";
  const xRobots = homepage.headers["x-robots-tag"]?.toLowerCase() ?? "";
  checks.push(robotsMeta.includes("noindex") || xRobots.includes("noindex")
    ? fail("indexability", "Homepage indexability", "The homepage is marked noindex.", "Remove the noindex directive from the production homepage.")
    : pass("indexability", "Homepage indexability", "No homepage noindex directive was found."));

  const robotsUrl = `${final.origin}/robots.txt`;
  let robots: SafeFetchResponse | null = null;
  try {
    robots = await fetchConfiguredHost(safeFetch, robotsUrl, rootHostname, fetchOptions);
    const blocksAll = /user-agent:\s*\*[\s\S]*?disallow:\s*\/(?:\s|$)/i.test(robots.bodyText);
    checks.push(robots.status === 200 && !blocksAll
      ? pass("robots", "robots.txt", "robots.txt is reachable and does not block the entire site.", robotsUrl)
      : fail("robots", "robots.txt", blocksAll ? "robots.txt blocks all crawlers from the entire site." : `robots.txt returned HTTP ${robots.status}.`, "Publish a production robots.txt that permits public pages."));
  } catch (error) {
    checks.push(warn("robots", "robots.txt", readableError(error), "Publish a reachable robots.txt on the primary hostname."));
  }

  const declaredSitemap = robots?.bodyText.match(/^sitemap:\s*(\S+)/im)?.[1];
  try {
    const sitemapUrl = declaredSitemap ? new URL(declaredSitemap, final.origin).toString() : `${final.origin}/sitemap.xml`;
    resolvedSitemapUrl = sitemapUrl;
    const sitemap = await fetchConfiguredHost(safeFetch, sitemapUrl, rootHostname, fetchOptions);
    const validXml = sitemap.status === 200 && isValidSitemapXml(sitemap.bodyText);
    const sitemapLocations = extractSitemapLocations(sitemap.bodyText);
    sitemapUrlCount = sitemapLocations.length;
    const hostileUrls = sitemapLocations.filter((location) => isHostileSitemapUrl(location, rootHostname));
    checks.push(validXml && sitemapLocations.length > 0 && hostileUrls.length === 0
      ? pass("sitemap", "XML sitemap", `The sitemap is valid and contains ${sitemapUrlCount} production URL(s).`, sitemapUrl)
      : fail("sitemap", "XML sitemap", !validXml ? "The sitemap is missing or is not valid sitemap XML." : sitemapLocations.length === 0 ? "The sitemap contains no discoverable URLs." : `The sitemap contains ${hostileUrls.length} malformed or off-domain URL(s).`, "Regenerate the sitemap using clean HTTPS URLs on the production domain."));
  } catch (error) {
    checks.push(fail("sitemap", "XML sitemap", readableError(error), "Publish a valid sitemap.xml and reference it from robots.txt."));
  }

  const metadata = {
    title: extractTitle(homepage.bodyText),
    description: extractMetaContent(homepage.bodyText, "description"),
    "og:title": extractMetaContent(homepage.bodyText, "og:title"),
    "og:description": extractMetaContent(homepage.bodyText, "og:description"),
    "og:url": extractMetaContent(homepage.bodyText, "og:url"),
    "og:image": extractMetaContent(homepage.bodyText, "og:image"),
  };
  const missingMetadata = Object.entries(metadata).filter(([, value]) => !value).map(([key]) => key);
  checks.push(missingMetadata.length === 0
    ? pass("metadata", "Homepage metadata", "Title, description, and required Open Graph metadata are present.")
    : warn("metadata", "Homepage metadata", `Missing: ${missingMetadata.join(", ")}.`, "Add complete homepage and Open Graph metadata."));

  const jsonLd = extractJsonLdBlocks(homepage.bodyText);
  const jsonLdTagCount = [...homepage.bodyText.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>/gi)].length;
  checks.push(jsonLd.length > 0
    ? pass("structured_data", "Structured data", `${jsonLd.length} valid JSON-LD block(s) found.`)
    : warn("structured_data", "Structured data", jsonLdTagCount > 0 ? "JSON-LD is present but invalid." : "JSON-LD is missing.", "Add valid Organization, LocalBusiness, or WebSite JSON-LD."));

  return result(checks.some((check) => check.state === "fail" || check.state === "warning") ? "needs_attention" : "healthy", homepage.finalUrl, checks);

  function result(status: SiteHealthResult["status"], finalUrl: string | null, currentChecks: SiteHealthCheck[]): SiteHealthResult {
    return {
      status,
      checkedAt: now().toISOString(),
      durationMs: Math.max(0, Date.now() - started),
      configuredUrl: configured.normalizedUrl,
      finalUrl,
      canonicalUrl: liveCanonicalUrl,
      primaryHostname,
      alternateHostname,
      sitemapUrl: resolvedSitemapUrl,
      sitemapUrlCount,
      robotsUrl: finalUrl ? `${new URL(finalUrl).origin}/robots.txt` : `${origin}/robots.txt`,
      checks: currentChecks,
    };
  }
}

async function fetchConfiguredHost(
  safeFetch: SafeFetchFn,
  url: string,
  rootHostname: string,
  options: Parameters<SafeFetchFn>[1],
) {
  const response = await safeFetch(url, options);
  for (const visited of response.redirectChain) assertConfiguredHostname(visited, rootHostname);
  assertConfiguredHostname(response.finalUrl, rootHostname);
  return response;
}

function assertConfiguredHostname(rawUrl: string, rootHostname: string) {
  const hostname = new URL(rawUrl).hostname.toLowerCase();
  if (hostname !== rootHostname && hostname !== `www.${rootHostname}`) {
    throw new UrlValidationError("blocked_hostname", "Redirect left the configured tenant hostname.");
  }
}

function isValidSitemapXml(xml: string) {
  const trimmed = xml.trim();
  if (!/^<\?xml\b[^>]*>/.test(trimmed)) return false;
  if (!/<(?:urlset|sitemapindex)\b[^>]*>/i.test(trimmed)) return false;
  return /<\/(?:urlset|sitemapindex)>\s*$/i.test(trimmed);
}

function extractSitemapLocations(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => match[1]);
}

function isHostileSitemapUrl(raw: string, rootHostname: string) {
  try {
    const url = new URL(raw);
    return url.protocol !== "https:" || url.hostname.replace(/^www\./, "") !== rootHostname || /\/\//.test(url.pathname);
  } catch { return true; }
}

function normalizePath(path: string) { return path.replace(/\/+$/, "") || "/"; }
function isPermanentRedirectChain(response: SafeFetchResponse) { return Boolean(response.redirectStatuses?.length && response.redirectStatuses.every((status) => status === 301 || status === 308)); }
function readableError(error: unknown) { return error instanceof Error ? error.message : "The request failed."; }
function pass(key: string, label: string, explanation: string, evidence?: string): SiteHealthCheck { return { key, label, state: "pass", explanation, evidence }; }
function warn(key: string, label: string, explanation: string, recommendation: string): SiteHealthCheck { return { key, label, state: "warning", explanation, recommendation }; }
function fail(key: string, label: string, explanation: string, recommendation: string): SiteHealthCheck { return { key, label, state: "fail", explanation, recommendation }; }
