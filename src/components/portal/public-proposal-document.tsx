import Link from "next/link";

export function PublicProposalDocument({
  token,
  title,
  html,
}: {
  token: string;
  title: string;
  html: string;
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm">
        <Link
          href={`/proposal/${token}`}
          className="underline underline-offset-2"
        >
          Back to proposal
        </Link>
      </p>
      <h1 className="mt-6 font-display text-3xl tracking-tight text-foreground">
        {title}
      </h1>
      <article
        className="prose prose-sm mt-6 max-w-none text-sm"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  );
}
