import { notFound } from "next/navigation";
import { PublicProposalDocument } from "@/components/portal/public-proposal-document";
import { getPublicProposal } from "@/lib/proposals/public-access";

export default async function PublicProposalSowPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const proposal = await getPublicProposal(token);
  if (!proposal?.sow) notFound();

  return (
    <PublicProposalDocument
      token={token}
      title={proposal.sow.title || "Statement of Work"}
      html={proposal.sow.content_html}
    />
  );
}
