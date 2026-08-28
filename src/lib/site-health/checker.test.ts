import { describe, expect, it } from "vitest";
import { checkConfiguredSite } from "@/lib/site-health/checker";
import type { SafeFetchFn, SafeFetchResponse } from "@/lib/audit/types";

const healthyHtml = `<!doctype html><html><head>
  <title>Example Company</title>
  <meta name="description" content="A useful description">
  <meta property="og:title" content="Example Company">
  <meta property="og:description" content="A useful description">
  <meta property="og:url" content="https://example.com/">
  <meta property="og:image" content="https://example.com/image.jpg">
  <link rel="canonical" href="https://example.com/">
  <script type="application/ld+json">{"@type":"Organization"}</script>
</head><body><h1>Example</h1></body></html>`;

function response(url: string, bodyText: string, overrides: Partial<SafeFetchResponse> = {}): SafeFetchResponse {
  return {
    url,
    finalUrl: url,
    status: 200,
    headers: {},
    bodyText,
    redirectChain: [url],
    redirectStatuses: [],
    ...overrides,
  };
}

function checker(overrides: Record<string, SafeFetchResponse | Error> = {}): SafeFetchFn {
  return async (rawUrl) => {
    const url = new URL(rawUrl).toString();
    const custom = overrides[url];
    if (custom instanceof Error) throw custom;
    if (custom) return custom;
    if (url === "https://example.com/") return response(url, healthyHtml);
    if (url === "http://example.com/") {
      return response(url, healthyHtml, {
        finalUrl: "https://example.com/",
        redirectChain: [url, "https://example.com/"],
        redirectStatuses: [301],
      });
    }
    if (url === "https://www.example.com/") {
      return response(url, healthyHtml, {
        finalUrl: "https://example.com/",
        redirectChain: [url, "https://example.com/"],
        redirectStatuses: [301],
      });
    }
    if (url === "https://example.com/robots.txt") {
      return response(url, "User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml");
    }
    if (url === "https://example.com/sitemap.xml") {
      return response(url, `<?xml version="1.0"?><urlset><url><loc>https://example.com/</loc></url></urlset>`);
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
}

async function run(overrides: Record<string, SafeFetchResponse | Error> = {}) {
  return checkConfiguredSite("https://example.com/", {
    safeFetch: checker(overrides),
    now: () => new Date("2026-08-28T12:00:00.000Z"),
  });
}

function state(result: Awaited<ReturnType<typeof run>>, key: string) {
  return result.checks.find((check) => check.key === key)?.state;
}

describe("checkConfiguredSite", () => {
  it("reports a fully configured site as healthy", async () => {
    const result = await run();
    expect(result.status).toBe("healthy");
    expect(result.checkedAt).toBe("2026-08-28T12:00:00.000Z");
  });

  it("reports a DNS or connection failure as an error", async () => {
    const result = await run({ "https://example.com/": new Error("Could not resolve hostname.") });
    expect(result.status).toBe("error");
    expect(state(result, "reachability")).toBe("fail");
  });

  it("flags a final HTTP URL", async () => {
    const result = await run({
      "https://example.com/": response("https://example.com/", healthyHtml, { finalUrl: "http://example.com/", redirectChain: ["https://example.com/", "http://example.com/"] }),
    });
    expect(state(result, "reachability")).toBe("fail");
  });

  it("blocks a redirect outside the configured hostname pair", async () => {
    const result = await run({
      "https://example.com/": response("https://example.com/", healthyHtml, { finalUrl: "https://evil.test/", redirectChain: ["https://example.com/", "https://evil.test/"] }),
    });
    expect(result.status).toBe("error");
  });

  it("warns when the alternate www hostname is unavailable", async () => {
    const result = await run({ "https://www.example.com/": new Error("Could not resolve hostname.") });
    expect(state(result, "www")).toBe("warning");
  });

  it("detects a www/non-www mismatch", async () => {
    const result = await run({
      "https://www.example.com/": response("https://www.example.com/", healthyHtml),
    });
    expect(state(result, "www")).toBe("warning");
  });

  it("records a redirect chain", async () => {
    const result = await run({
      "https://example.com/": response("https://example.com/", healthyHtml, {
        redirectChain: ["https://example.com/", "https://www.example.com/", "https://example.com/"],
        redirectStatuses: [302, 301],
      }),
    });
    expect(result.checks.find((check) => check.key === "redirects")?.evidence).toContain("www.example.com");
  });

  it("fails when the canonical is missing", async () => {
    const result = await run({ "https://example.com/": response("https://example.com/", healthyHtml.replace(/<link[^>]+>/, "")) });
    expect(state(result, "canonical")).toBe("fail");
  });

  it("fails when the canonical uses the wrong hostname", async () => {
    const html = healthyHtml.replace(
      '<link rel="canonical" href="https://example.com/">',
      '<link rel="canonical" href="https://www.example.com/">',
    );
    const result = await run({ "https://example.com/": response("https://example.com/", html) });
    expect(state(result, "canonical")).toBe("fail");
  });

  it("fails a malformed canonical without aborting the check", async () => {
    const html = healthyHtml.replace(
      '<link rel="canonical" href="https://example.com/">',
      '<link rel="canonical" href="http://[">',
    );
    const result = await run({ "https://example.com/": response("https://example.com/", html) });
    expect(state(result, "canonical")).toBe("fail");
  });

  it("detects a meta robots noindex directive", async () => {
    const html = healthyHtml.replace("</head>", '<meta name="robots" content="noindex"></head>');
    const result = await run({ "https://example.com/": response("https://example.com/", html) });
    expect(state(result, "indexability")).toBe("fail");
  });

  it("detects an X-Robots-Tag noindex directive", async () => {
    const result = await run({ "https://example.com/": response("https://example.com/", healthyHtml, { headers: { "x-robots-tag": "noindex" } }) });
    expect(state(result, "indexability")).toBe("fail");
  });

  it("detects robots.txt blocking the entire site", async () => {
    const result = await run({ "https://example.com/robots.txt": response("https://example.com/robots.txt", "User-agent: *\nDisallow: /") });
    expect(state(result, "robots")).toBe("fail");
  });

  it("rejects malformed sitemap XML", async () => {
    const result = await run({ "https://example.com/sitemap.xml": response("https://example.com/sitemap.xml", "<html>not a sitemap</html>") });
    expect(state(result, "sitemap")).toBe("fail");
  });

  it("reports a missing sitemap", async () => {
    const result = await run({ "https://example.com/sitemap.xml": response("https://example.com/sitemap.xml", "Not found", { status: 404 }) });
    expect(state(result, "sitemap")).toBe("fail");
  });

  it("fails when a custom production domain leaks a Vercel URL in its sitemap", async () => {
    const xml = `<?xml version="1.0"?><urlset><url><loc>https://preview.vercel.app/page</loc></url></urlset>`;
    const result = await run({ "https://example.com/sitemap.xml": response("https://example.com/sitemap.xml", xml) });
    expect(state(result, "sitemap")).toBe("fail");
  });

  it("detects off-domain and double-slash sitemap URLs", async () => {
    const xml = `<?xml version="1.0"?><urlset><url><loc>https://evil.test/page</loc></url><url><loc>https://example.com//bad</loc></url></urlset>`;
    const result = await run({ "https://example.com/sitemap.xml": response("https://example.com/sitemap.xml", xml) });
    expect(state(result, "sitemap")).toBe("fail");
  });

  it("warns when metadata and JSON-LD are absent", async () => {
    const html = `<html><head><link rel="canonical" href="https://example.com/"></head><body></body></html>`;
    const result = await run({ "https://example.com/": response("https://example.com/", html) });
    expect(state(result, "metadata")).toBe("warning");
    expect(state(result, "structured_data")).toBe("warning");
  });

  it("reports a timeout as an unavailable-site error", async () => {
    const timeout = new Error("Request timed out.");
    timeout.name = "AbortError";
    const result = await run({ "https://example.com/": timeout });
    expect(result.status).toBe("error");
    expect(result.checks.find((check) => check.key === "reachability")?.explanation).toContain("timed out");
  });

  it("treats an intentional Vercel production hostname as healthy", async () => {
    const hostname = "dawg-ashen.vercel.app";
    const html = healthyHtml.replaceAll("example.com", hostname);
    const safeFetch: SafeFetchFn = async (rawUrl) => {
      const url = new URL(rawUrl).toString();
      if (url === `https://${hostname}/`) return response(url, html);
      if (url === `http://${hostname}/`) {
        return response(url, html, {
          finalUrl: `https://${hostname}/`,
          redirectChain: [url, `https://${hostname}/`],
          redirectStatuses: [308],
        });
      }
      if (url === `https://${hostname}/robots.txt`) {
        return response(url, `User-agent: *\nAllow: /\nSitemap: https://${hostname}/sitemap.xml`);
      }
      if (url === `https://${hostname}/sitemap.xml`) {
        return response(url, `<?xml version="1.0"?><urlset><url><loc>https://${hostname}/</loc></url></urlset>`);
      }
      throw new Error(`Unexpected URL: ${url}`);
    };
    const result = await checkConfiguredSite(`https://${hostname}/`, { safeFetch });
    expect(result.checks.find((check) => check.key === "production_domain")?.state).toBe("pass");
    expect(result.checks.find((check) => check.key === "www")?.state).toBe("pass");
    expect(result.status).toBe("healthy");
  });

  it("fails when a custom production domain leaks a Vercel canonical", async () => {
    const html = healthyHtml.replace(
      '<link rel="canonical" href="https://example.com/">',
      '<link rel="canonical" href="https://example-preview.vercel.app/">',
    );
    const result = await run({ "https://example.com/": response("https://example.com/", html) });
    expect(state(result, "canonical")).toBe("fail");
  });

  it("fails when a custom production domain redirects to an unrelated Vercel hostname", async () => {
    const result = await run({
      "https://example.com/": response("https://example.com/", healthyHtml, {
        finalUrl: "https://unrelated.vercel.app/",
        redirectChain: ["https://example.com/", "https://unrelated.vercel.app/"],
        redirectStatuses: [302],
      }),
    });
    expect(result.status).toBe("error");
    expect(result.checks.find((check) => check.key === "reachability")?.explanation).toContain("configured tenant hostname");
  });

  it("fails metadata that leaks a different Vercel deployment", async () => {
    const html = healthyHtml.replace(
      'content="https://example.com/image.jpg"',
      'content="https://example-preview.vercel.app/image.jpg"',
    );
    const result = await run({ "https://example.com/": response("https://example.com/", html) });
    expect(state(result, "metadata")).toBe("fail");
  });
});
