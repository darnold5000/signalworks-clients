import type { AdminClientBundle } from "@/lib/admin/client-records";
import {
  buildInfrastructureHealthChips,
  parseServiceOwnership,
  SERVICE_OWNERSHIP_KEYS,
  SERVICE_OWNERSHIP_LABELS,
} from "@/lib/technical/operations-inventory";
import { Panel } from "@/components/ui";
import { InfrastructureHealthChips } from "@/components/admin/infrastructure-health-chips";
import { TechnicalProfileForm } from "@/components/admin/technical-profile-form";

export function TechnicalProfileView({
  bundle,
  tenantId,
}: {
  bundle: AdminClientBundle;
  tenantId: string;
}) {
  const technical = bundle.technical;
  const chips = buildInfrastructureHealthChips(technical);
  const ownership = parseServiceOwnership(
    technical?.service_ownership,
    technical?.managed_services,
  );

  return (
    <div className="space-y-6">
      <Panel title="Operations inventory">
        <p className="mb-3 text-sm text-muted">
          Structured hosting, data platform, business services, integrations,
          ownership, and access metadata for troubleshooting.
        </p>
        <InfrastructureHealthChips chips={chips} max={12} />
        {SERVICE_OWNERSHIP_KEYS.some((k) => ownership[k]) ? (
          <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
            {SERVICE_OWNERSHIP_KEYS.filter((k) => ownership[k]).map((key) => (
              <div key={key} className="flex justify-between gap-2 border-b border-border py-1">
                <dt className="text-muted">{SERVICE_OWNERSHIP_LABELS[key]}</dt>
                <dd className="font-medium capitalize">
                  {ownership[key]?.replaceAll("_", " ")}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </Panel>

      <TechnicalProfileForm tenantId={tenantId} bundle={bundle} />
    </div>
  );
}
