import Link from "next/link";
import type { AdminClientBundle } from "@/lib/admin/client-records";
import { buildTechnologyServiceRows } from "@/lib/technical/operations-inventory";
import { ButtonLink, Panel } from "@/components/ui";

export function InfrastructureSummaryCard({
  bundle,
}: {
  bundle: AdminClientBundle;
}) {
  const rows = buildTechnologyServiceRows({
    technical: bundle.technical,
    clientDomain: bundle.client.domain,
    clientWebsiteUrl:
      bundle.client.website_url ?? bundle.profile?.website_url ?? null,
  });

  return (
    <Panel>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold tracking-wide text-foreground uppercase">
          Technology &amp; Services
        </h2>
        <ButtonLink
          href={`/admin/clients/${bundle.client.id}/technical`}
          variant="secondary"
        >
          Edit
        </ButtonLink>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">
          No technology or services configured.{" "}
          <Link
            href={`/admin/clients/${bundle.client.id}/technical`}
            className="underline underline-offset-2"
          >
            Add details
          </Link>
        </p>
      ) : (
        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.id} className="min-w-0">
              <dt className="text-xs font-medium tracking-wide text-muted uppercase">
                {row.label}
              </dt>
              <dd className="mt-1 text-sm font-semibold break-words">
                {row.value}
              </dd>
              {row.details.map((detail) => (
                <dd key={detail} className="mt-0.5 text-xs text-muted break-words">
                  {detail}
                </dd>
              ))}
            </div>
          ))}
        </dl>
      )}
    </Panel>
  );
}
