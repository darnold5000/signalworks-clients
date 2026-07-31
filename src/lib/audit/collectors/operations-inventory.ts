import { verifiedFinding } from "@/lib/audit/collectors/shared/finding";
import {
  SERVICE_OWNERSHIP_KEYS,
  SERVICE_OWNERSHIP_LABELS,
} from "@/lib/technical/operations-inventory";
import type { AuditCollector, AuditFindingInput } from "@/lib/audit/types";

const COLLECTOR_KEY = "operations_inventory";

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim() === "" || value === "none" || value === "unknown";
}

export const operationsInventoryCollector: AuditCollector = {
  key: COLLECTOR_KEY,
  supports: (scope) => scope.includeOperationsInventory,

  async collect(context) {
    const findings: AuditFindingInput[] = [];

    if (!context.tenantId) {
      return {
        collectorKey: COLLECTOR_KEY,
        findings: [
          verifiedFinding({
            category: "operations",
            checkKey: "operations.inventory.no_tenant",
            severity: "low",
            status: "unavailable",
            title: "Operations inventory not applicable",
            summary: "No tenant is associated with this audit request.",
          }),
        ],
      };
    }

    let profile;
    try {
      profile = await context.services.loadTechnicalProfile(context.tenantId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load operations inventory";
      return {
        collectorKey: COLLECTOR_KEY,
        findings: [],
        errorCode: "operations_inventory_load_failed",
        errorMessage: message,
      };
    }

    if (!profile) {
      findings.push(
        verifiedFinding({
          category: "operations",
          checkKey: "operations.inventory.missing",
          severity: "medium",
          status: "manual_review",
          title: "Operations inventory not recorded",
          summary:
            "No Operations Inventory profile exists for this client. Staff should complete the technical profile.",
        }),
      );
      return { collectorKey: COLLECTOR_KEY, findings };
    }

    const coverageChecks: Array<{
      checkKey: string;
      label: string;
      value: string | null | undefined;
    }> = [
      { checkKey: "operations.registrar.recorded", label: "Domain registrar", value: profile.domain_registrar },
      { checkKey: "operations.dns.recorded", label: "DNS provider", value: profile.dns_provider },
      { checkKey: "operations.hosting.recorded", label: "Hosting platform", value: profile.hosting_provider ?? profile.deployment_platform },
      { checkKey: "operations.database.recorded", label: "Database provider", value: profile.database_provider },
      { checkKey: "operations.email.recorded", label: "Email provider", value: profile.email_provider },
      { checkKey: "operations.analytics.recorded", label: "Analytics provider", value: profile.analytics_provider },
    ];

    for (const check of coverageChecks) {
      const recorded = !isBlank(check.value);
      findings.push(
        verifiedFinding({
          category: "operations",
          checkKey: check.checkKey,
          severity: recorded ? "info" : "low",
          status: recorded ? "pass" : "manual_review",
          title: recorded ? `${check.label} recorded` : `${check.label} not recorded`,
          summary: recorded
            ? `${check.label}: ${check.value}`
            : `${check.label} is not documented in Operations Inventory.`,
          evidenceJson: { value: check.value ?? null },
        }),
      );
    }

    if (profile.database_shared_platform === true) {
      findings.push(
        verifiedFinding({
          category: "operations",
          checkKey: "operations.database.shared_platform",
          severity: "low",
          status: "warning",
          title: "Shared database platform documented",
          summary: "Operations Inventory indicates a shared platform database.",
          evidenceJson: { database_shared_platform: true, database_plan: profile.database_plan },
        }),
      );
    }

    if (isBlank(profile.backup_policy) && !profile.last_backup_verified_at) {
      findings.push(
        verifiedFinding({
          category: "operations",
          checkKey: "operations.backups.unknown",
          severity: "medium",
          status: "manual_review",
          title: "Backup policy not documented",
          summary: "No backup policy or last verified backup date is recorded.",
        }),
      );
    } else {
      findings.push(
        verifiedFinding({
          category: "operations",
          checkKey: "operations.backups.documented",
          severity: "info",
          status: "pass",
          title: "Backup information documented",
          summary: profile.backup_policy
            ? `Backup policy: ${profile.backup_policy}`
            : `Last backup verified: ${profile.last_backup_verified_at}`,
        }),
      );
    }

    const ownership = (profile.service_ownership ?? {}) as Record<string, string>;
    const undocumentedOwners = SERVICE_OWNERSHIP_KEYS.filter((key) => !ownership[key]);
    findings.push(
      verifiedFinding({
        category: "operations",
        checkKey: "operations.service_ownership.coverage",
        severity: undocumentedOwners.length > 3 ? "medium" : "info",
        status: undocumentedOwners.length === 0 ? "pass" : "warning",
        title: "Service ownership matrix coverage",
        summary:
          undocumentedOwners.length === 0
            ? "All major services have ownership documented."
            : `Missing ownership for: ${undocumentedOwners.map((key) => SERVICE_OWNERSHIP_LABELS[key]).join(", ")}.`,
        evidenceJson: { ownership, undocumentedOwners },
      }),
    );

    const stripeStatus = profile.stripe_connection_status;
    findings.push(
      verifiedFinding({
        category: "operations",
        checkKey: "operations.stripe.status",
        severity: "info",
        status: stripeStatus === "connected" ? "pass" : stripeStatus ? "warning" : "manual_review",
        title: stripeStatus
          ? `Stripe status: ${stripeStatus}`
          : "Stripe connection status not documented",
        summary: stripeStatus
          ? `Operations Inventory lists Stripe as ${stripeStatus}.`
          : "Stripe connection status is not recorded in Operations Inventory.",
        evidenceJson: { stripe_connection_status: stripeStatus },
      }),
    );

    return {
      collectorKey: COLLECTOR_KEY,
      findings,
      evidence: {
        tenantId: context.tenantId,
        hostingProvider: profile.hosting_provider,
        databaseProvider: profile.database_provider,
      },
    };
  },
};
