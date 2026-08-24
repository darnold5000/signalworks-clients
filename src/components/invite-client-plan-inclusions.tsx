"use client";

import { InclusionItemsEditor } from "@/components/inclusion-items-editor";

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

export function InviteClientPlanInclusions({
  planInclusions,
  setupInclusions,
  onPlanInclusionsChange,
  onSetupInclusionsChange,
}: {
  planInclusions: string[];
  setupInclusions: string[];
  onPlanInclusionsChange: (items: string[]) => void;
  onSetupInclusionsChange: (items: string[]) => void;
}) {
  return (
    <section className="space-y-3">
      <InclusionCard title="Included with this plan">
        <InclusionItemsEditor label="Plan items" items={planInclusions} onChange={onPlanInclusionsChange} />
      </InclusionCard>
      <InclusionCard title="Included setup">
        <InclusionItemsEditor label="Setup items" items={setupInclusions} onChange={onSetupInclusionsChange} />
      </InclusionCard>
    </section>
  );
}
