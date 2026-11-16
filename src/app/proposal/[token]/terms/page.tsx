import { notFound } from "next/navigation";
import { PublicProposalDocument } from "@/components/portal/public-proposal-document";
import { isPlatformTermsDocument, termsDocumentHtml } from "@/lib/legal/signal-works-tos";
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
      title={
        isPlatformTermsDocument(proposal.terms)
          ? "Terms of Service"
          : proposal.terms.title || "Terms of Service"
      }
      html={termsDocumentHtml(proposal.terms)}
    />
  );
}
