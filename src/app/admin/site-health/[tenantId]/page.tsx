import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHealthDetail } from "@/components/admin/site-health-detail";
import { PageHeader } from "@/components/ui";
import { getSiteHealthSite } from "@/lib/site-health/service";

export default async function SiteHealthDetailPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const site = await getSiteHealthSite(tenantId);
  if (!site) notFound();
  return (
    <>
      <Link href="/admin/site-health" className="mb-4 inline-block text-sm text-accent">← All sites</Link>
      <PageHeader title={site.name} description="Production website health, configuration, and launch readiness." />
      <SiteHealthDetail site={site} />
    </>
  );
}
