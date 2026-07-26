import Link from "next/link";
import type { AdminClientBundle } from "@/lib/admin/client-records";
import { buildInfrastructureHealthChips } from "@/lib/technical/operations-inventory";
import { ButtonLink, Panel } from "@/components/ui";
import { InfrastructureHealthChips } from "@/components/admin/infrastructure-health-chips";

export function InfrastructureSummaryCard({
  bundle,
}: {
  bundle: AdminClientBundle;
}) {
  const chips = buildInfrastructureHealthChips(bundle.technical);

  return (
    <Panel title="Operations inventory">
      {chips.length === 0 ? (
        <p className="text-sm text-muted">
          No inventory recorded yet.{" "}
          <Link
            href={`/admin/clients/${bundle.client.id}/technical`}
            className="underline underline-offset-2"
          >
            Add operations inventory
          </Link>
        </p>
      ) : (
        <InfrastructureHealthChips chips={chips} max={8} />
      )}
      <div className="mt-4">
        <ButtonLink
          href={`/admin/clients/${bundle.client.id}/technical`}
          variant="secondary"
        >
          Edit operations inventory
        </ButtonLink>
      </div>
    </Panel>
  );
}
