import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Support | AlphaClone Systems',
  description: 'Get help with AlphaClone Systems, account access, integrations, billing, privacy, and MCP connections.',
  alternates: { canonical: 'https://alphaclonesystems.com/support' },
};

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-[var(--marketing-bg-primary)] px-6 py-20 text-[var(--marketing-text-primary)]">
      <section className="mx-auto max-w-3xl">
        <p className="type-caption text-[var(--marketing-accent-hover)]">AlphaClone Systems</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Support</h1>
        <p className="mt-5 max-w-2xl text-[var(--marketing-text-secondary)]">
          Get help with your AlphaClone account, integrations, billing, client workflows, or AI and MCP connections.
        </p>
        <div className="mt-10 rounded-2xl border border-[var(--marketing-border)] bg-[var(--marketing-bg-secondary)] p-6">
          <h2 className="text-xl font-semibold">Contact support</h2>
          <p className="mt-3 text-[var(--marketing-text-secondary)]">
            Email <a className="text-[var(--marketing-accent-hover)] hover:underline" href="mailto:support@alphaclonesystems.com">support@alphaclonesystems.com</a>.
            Include the affected workspace, the action you were trying to complete, and any visible error message. Never send passwords, API keys, or access tokens.
          </p>
        </div>
        <nav className="mt-8 flex flex-wrap gap-4 text-sm">
          <Link className="hover:underline" href="/legal/privacy">Privacy Policy</Link>
          <Link className="hover:underline" href="/legal/terms">Terms of Service</Link>
          <Link className="hover:underline" href="/legal">Legal & Trust</Link>
        </nav>
      </section>
    </main>
  );
}
