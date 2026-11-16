import { notFound } from "next/navigation";
import { PublicProposalDocument } from "@/components/portal/public-proposal-document";
import { getPublicProposal } from "@/lib/proposals/public-access";

export default async function PublicProposalTermsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const proposal = await getPublicProposal(token);
  if (!proposal?.terms) notFound();

  return (
    <PublicProposalDocument
      token={token}
      title={proposal.terms.title || "Terms of Service"}
      html={proposal.terms.content_html}
    />
  );
}
