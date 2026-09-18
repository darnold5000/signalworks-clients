import type { AdminClientBundle } from "@/lib/admin/client-records";
import { TechnicalProfileForm } from "@/components/admin/technical-profile-form";

export function TechnicalProfileView({
  bundle,
  tenantId,
}: {
  bundle: AdminClientBundle;
  tenantId: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">
          Technology &amp; Services
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          The operational details needed to find and support this client’s
          services. Do not store credentials or secrets here.
        </p>
      </div>
      <TechnicalProfileForm tenantId={tenantId} bundle={bundle} />
    </div>
  );
}
