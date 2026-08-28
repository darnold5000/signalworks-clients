import { PageHeader } from "@/components/ui";
import { SiteHealthDashboard } from "@/components/admin/site-health-dashboard";
import { listSiteHealthSites } from "@/lib/site-health/service";

export default async function SiteHealthPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const excludedView = (await searchParams).view === "excluded";
  const allSites = await listSiteHealthSites();
  const sites = allSites.filter((site) =>
    excludedView ? !site.monitoringEnabled : site.monitoringEnabled,
  );
  return (
    <>
      <PageHeader title="Site Health" description="Monitor production-domain readiness, crawlability, metadata, and launch verification across managed websites." />
      <SiteHealthDashboard sites={sites} excludedView={excludedView} />
    </>
  );
}
