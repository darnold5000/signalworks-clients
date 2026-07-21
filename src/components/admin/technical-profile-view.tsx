import type { AdminClientBundle } from "@/lib/admin/client-records";
import { CopyValueButton } from "@/components/admin/copy-value-button";
import { MetaRow, Panel } from "@/components/ui";
import { formatDate } from "@/lib/utils";

function TechnicalRow({
  label,
  value,
  copyLabel,
}: {
  label: string;
  value: string | null | undefined;
  copyLabel?: string;
}) {
  const display = value?.trim() ? value : "—";
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="flex max-w-[65%] flex-col items-end gap-1 text-right text-sm font-medium">
        <span className="break-all">{display}</span>
        {value && copyLabel ? (
          <CopyValueButton value={value} label={copyLabel} />
        ) : null}
      </dd>
    </div>
  );
}

export function TechnicalProfileView({ bundle }: { bundle: AdminClientBundle }) {
  const technical = bundle.technical;
  const client = bundle.client;

  if (!technical) {
    return (
      <Panel title="Technical profile">
        <p className="text-sm text-muted">
          No technical profile yet. Portal settings still show{" "}
          {client.hosting_platform ?? "—"} hosting and{" "}
          {client.database_platform ?? "—"} database from the legacy portal
          record.
        </p>
        <dl className="mt-4">
          <MetaRow label="Hosting" value={client.hosting_platform ?? "—"} />
          <MetaRow label="Database" value={client.database_platform ?? "—"} />
          <MetaRow label="Registrar" value={client.registrar ?? "—"} />
          <MetaRow label="Domain owner" value={client.domain_owner ?? "—"} />
        </dl>
      </Panel>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Application">
        <dl>
          <TechnicalRow label="Architecture" value={technical.architecture_type} />
          <TechnicalRow
            label="Production URL"
            value={technical.production_url ?? client.website_url}
          />
          <TechnicalRow
            label="Source ownership"
            value={technical.source_code_ownership}
          />
        </dl>
      </Panel>

      <Panel title="GitHub repository">
        <dl>
          <TechnicalRow label="Provider" value={technical.repository_provider} />
          <TechnicalRow
            label="Repository"
            value={
              technical.repository_owner && technical.repository_name
                ? `${technical.repository_owner}/${technical.repository_name}`
                : technical.repository_name
            }
            copyLabel="repository"
          />
          <TechnicalRow label="Branch" value={technical.default_branch} />
          <TechnicalRow label="URL" value={technical.repository_url} />
        </dl>
      </Panel>

      <Panel title="Hosting">
        <dl>
          <TechnicalRow label="Provider" value={technical.hosting_provider} />
          <TechnicalRow
            label="Project name"
            value={technical.hosting_project_name}
            copyLabel="project name"
          />
          <TechnicalRow
            label="Project ID"
            value={technical.hosting_project_id}
            copyLabel="project ID"
          />
        </dl>
      </Panel>

      <Panel title="Domain & DNS">
        <dl>
          <TechnicalRow label="Primary domain" value={technical.primary_domain} />
          <TechnicalRow label="Registrar" value={technical.domain_registrar} />
          <TechnicalRow label="DNS provider" value={technical.dns_provider} />
        </dl>
      </Panel>

      <Panel title="Database">
        <dl>
          <TechnicalRow label="Provider" value={technical.database_provider} />
          <TechnicalRow
            label="Project name"
            value={technical.database_project_name}
          />
          <TechnicalRow
            label="Project reference"
            value={technical.database_project_reference}
            copyLabel="project reference"
          />
          <TechnicalRow label="Region" value={technical.database_region} />
          <TechnicalRow label="Schema" value={technical.database_schema_name} />
        </dl>
      </Panel>

      <Panel title="Payments & email">
        <dl>
          <TechnicalRow label="Stripe account type" value={technical.stripe_account_type} />
          <TechnicalRow
            label="Connected account"
            value={technical.stripe_connected_account_id}
            copyLabel="account ID"
          />
          <TechnicalRow label="Email provider" value={technical.email_provider} />
          <TechnicalRow
            label="Sending domain"
            value={technical.email_sending_domain}
          />
        </dl>
      </Panel>

      <Panel title="Backups & notes" className="lg:col-span-2">
        <dl>
          <TechnicalRow label="Backup policy" value={technical.backup_policy} />
          <TechnicalRow
            label="Last backup verified"
            value={formatDate(technical.last_backup_verified_at)}
          />
          <TechnicalRow
            label="Deployment notes"
            value={technical.deployment_notes}
          />
          <TechnicalRow label="Technical notes" value={technical.technical_notes} />
        </dl>
      </Panel>
    </div>
  );
}
