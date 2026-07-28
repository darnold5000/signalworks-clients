"use client";

import {
  INCLUDED_SETUP_ITEMS,
  PLAN_STANDARD_INCLUSIONS,
} from "@/lib/catalog/plan-inclusions";

function InclusionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/60 p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h4>
      <div className="mt-2 text-sm text-foreground">{children}</div>
    </div>
  );
}

export function InviteClientPlanInclusions() {
  const planNames = PLAN_STANDARD_INCLUSIONS.map((row) => row.name);
  const mid = Math.ceil(planNames.length / 2);

  return (
    <section className="space-y-3">
      <InclusionCard title="Included with this plan">
        <p className="leading-relaxed text-muted">
          {planNames.slice(0, mid).join(" · ")}
        </p>
        <p className="mt-1 leading-relaxed text-muted">
          {planNames.slice(mid).join(" · ")}
        </p>
      </InclusionCard>
      <InclusionCard title="Included setup">
        <p className="text-muted">
          {INCLUDED_SETUP_ITEMS.map((row) => row.name).join(" · ")}
        </p>
      </InclusionCard>
    </section>
  );
}
