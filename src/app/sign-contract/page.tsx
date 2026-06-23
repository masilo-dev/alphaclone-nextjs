import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Contract Signing Redirect | AlphaClone Systems',
  description: 'Redirects legacy contract signing links to the current secure signing portal.',
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const token = Array.isArray(resolvedSearchParams?.token)
    ? resolvedSearchParams.token[0]
    : resolvedSearchParams?.token;

  if (token) {
    redirect(`/sign/${encodeURIComponent(token)}`);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200">
      <div className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-16">
        <div className="w-full rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl shadow-black/30">
          <p className="text-xs uppercase tracking-[0.3em] text-teal-400">Legacy link</p>
          <h1 className="mt-4 text-3xl font-semibold text-white">Signing token missing</h1>
          <p className="mt-4 text-sm leading-7 text-slate-400">
            This old contract link needs a token in the query string. If you opened a copied email, the correct format is
            <span className="mx-1 rounded bg-slate-800 px-2 py-0.5 font-mono text-slate-200">/sign-contract?token=...</span>.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-teal-500 px-4 py-3 font-semibold text-slate-950 transition-colors hover:bg-teal-400"
          >
            Go to homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
