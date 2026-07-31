import { describe, expect, it } from "vitest";
import {
  normalizeAuditUrl,
  UrlValidationError,
} from "@/lib/audit/url/normalize";
import { assertResolvedAddressAllowed } from "@/lib/audit/url/ssrf";
import {
  countFailedCollectors,
  createInitialProgress,
  resolveRunStatus,
  withCollectorFinished,
} from "@/lib/audit/runner/progress";

describe("normalizeAuditUrl", () => {
  it("adds https and strips hash", () => {
    const result = normalizeAuditUrl("Example.com/path#section");
    expect(result.normalizedUrl).toBe("https://example.com/path");
    expect(result.normalizedDomain).toBe("example.com");
    expect(result.hostname).toBe("example.com");
  });

  it("rejects embedded credentials", () => {
    expect(() => normalizeAuditUrl("https://user:pass@example.com")).toThrow(
      UrlValidationError,
    );
  });

  it("rejects localhost", () => {
    expect(() => normalizeAuditUrl("http://localhost")).toThrow(UrlValidationError);
  });

  it("rejects private literal IPv4", () => {
    expect(() => normalizeAuditUrl("http://192.168.1.10")).toThrow(
      UrlValidationError,
    );
    expect(() => normalizeAuditUrl("http://10.0.0.5")).toThrow(UrlValidationError);
    expect(() => normalizeAuditUrl("http://127.0.0.1")).toThrow(UrlValidationError);
  });

  it("rejects non-default ports", () => {
    expect(() => normalizeAuditUrl("http://example.com:8080")).toThrow(
      UrlValidationError,
    );
  });
});

describe("assertResolvedAddressAllowed", () => {
  it("blocks private resolved addresses", () => {
    expect(() => assertResolvedAddressAllowed("10.1.2.3")).toThrow();
    expect(() => assertResolvedAddressAllowed("192.168.0.1")).toThrow();
    expect(() => assertResolvedAddressAllowed("::1")).toThrow();
  });

  it("allows public resolved addresses", () => {
    expect(() => assertResolvedAddressAllowed("8.8.8.8")).not.toThrow();
  });
});

describe("audit run progress", () => {
  it("tracks collector failures for partial success", () => {
    let progress = createInitialProgress(["http_hosting", "metadata"]);
    progress = withCollectorFinished(progress, "http_hosting", {
      status: "succeeded",
    });
    progress = withCollectorFinished(progress, "metadata", {
      status: "failed",
      errorCode: "timeout",
    });

    expect(countFailedCollectors(progress)).toEqual(["metadata"]);
    expect(resolveRunStatus(progress, false)).toBe("partially_succeeded");
  });

  it("marks fatal errors as failed", () => {
    const progress = createInitialProgress(["http_hosting"]);
    expect(resolveRunStatus(progress, true)).toBe("failed");
  });
});
