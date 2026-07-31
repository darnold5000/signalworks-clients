import type { TenantTechnicalProfile } from "@/lib/database/phase1-types";
import type { PageSpeedClient } from "@/lib/audit/collectors/pagespeed/client";
import { createPageSpeedClient } from "@/lib/audit/collectors/pagespeed/client";
import type {
  AuditCollectorServices,
  NormalizedAuditUrl,
  SafeFetchFn,
  SafeFetchResponse,
} from "@/lib/audit/types";

export type CreateCollectorServicesInput = {
  url: NormalizedAuditUrl;
  fetchPage: SafeFetchFn;
  pagespeedClient?: PageSpeedClient;
  loadTechnicalProfile?: (
    tenantId: string,
  ) => Promise<TenantTechnicalProfile | null>;
};

export function createCollectorServices(
  input: CreateCollectorServicesInput,
): AuditCollectorServices {
  let homepagePromise: Promise<SafeFetchResponse | null> | undefined;

  return {
    url: input.url,
    fetchPage: input.fetchPage,
    pagespeed: input.pagespeedClient ?? createPageSpeedClient(),
    loadTechnicalProfile:
      input.loadTechnicalProfile ?? (async () => null),

    getHomepage() {
      if (!homepagePromise) {
        homepagePromise = input
          .fetchPage(input.url.normalizedUrl)
          .then((response) => response)
          .catch(() => null);
      }
      return homepagePromise;
    },

    primeHomepage(response: SafeFetchResponse | null) {
      homepagePromise = Promise.resolve(response);
    },
  };
}
