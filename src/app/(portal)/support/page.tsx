import { PageHeader, Panel } from "@/components/ui";
import { getPrimaryClient } from "@/lib/data";
import { siteConfig } from "@/lib/site";
import { notFound } from "next/navigation";

export default async function SupportPage() {
  const client = await getPrimaryClient();
  if (!client) notFound();
  const email = client.support_email ?? siteConfig.supportEmail;

  return (
    <>
      <PageHeader
        title="Support"
        description="We’re here for website updates, hosting questions, and anything else on your plan."
      />
      <Panel>
        <p className="text-sm text-muted">
          Prefer email? Reach us at{" "}
          <a
            className="font-medium text-foreground underline underline-offset-2"
            href={`mailto:${email}`}
          >
            {email}
          </a>
          .
        </p>
        <p className="mt-4 text-sm text-muted">
          For day-to-day website changes, use{" "}
          <a href="/requests" className="underline underline-offset-2">
            Requests
          </a>{" "}
          so everything stays tracked.
        </p>
        {client.support_phone ? (
          <p className="mt-4 text-sm text-muted">Phone: {client.support_phone}</p>
        ) : null}
      </Panel>
    </>
  );
}
