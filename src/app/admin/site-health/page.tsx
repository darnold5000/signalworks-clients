import { PageHeader } from "@/components/ui";
import { SiteHealthDashboard } from "@/components/admin/site-health-dashboard";
import { listSiteHealthSites } from "@/lib/site-health/service";

export default async function SiteHealthPage() {
  const sites = await listSiteHealthSites();
  return (
    <>
      <PageHeader title="Site Health" description="Monitor production-domain readiness, crawlability, metadata, and launch verification across managed websites." />
      <SiteHealthDashboard sites={sites} />
    </>
  );
}
