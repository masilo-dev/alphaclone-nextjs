import type { Metadata } from 'next';
import Link from 'next/link';

const SITE_PAGES = [
  { href: '/services', title: 'Services', description: 'AI growth agent, CRM, invoicing, contracts, meetings, and more.' },
  { href: '/guide', title: 'Platform Guide', description: 'Step-by-step setup and onboarding guide.' },
  { href: '/onboarding/create-business', title: 'Create Business Workspace', description: 'Create a new workspace and choose a plan.' },
  { href: '/crm', title: 'CRM', description: 'Client records, pipeline, and follow-up workflows.' },
  { href: '/lead-management', title: 'Lead Management', description: 'Lead capture, qualification, and tracking.' },
  { href: '/project-management', title: 'Project Management', description: 'Tasks, milestones, and delivery tracking.' },
  { href: '/ai-agents', title: 'AI Agents', description: 'AI-assisted growth and automation workflows.' },
  { href: '/video-meetings', title: 'Video Meetings', description: 'Built-in client meetings and call workflows.' },
  { href: '/claude-manus-integrations', title: 'Claude and Manus MCP', description: 'External AI agent integration setup.' },
  { href: '/legal', title: 'Legal Hub', description: 'Policy center with privacy, terms, cookies, and rights.' },
  { href: '/legal/privacy', title: 'Privacy Policy', description: 'How we collect, use, and protect data.' },
  { href: '/legal/terms', title: 'Terms of Service', description: 'Billing, usage rules, AI features, and liability.' },
  { href: '/legal/cookies', title: 'Cookie Policy', description: 'Cookie controls and preference management.' },
  { href: '/legal/acceptable-use', title: 'Acceptable Use Policy', description: 'Platform usage boundaries and prohibited activity.' },
  { href: '/legal/data-request', title: 'Data Requests', description: 'Access, export, correction, and deletion requests.' },
  { href: '/pricing', title: 'Pricing', description: 'Plans and subscription details.' },
  { href: '/about', title: 'About', description: 'Mission, values, and company background.' },
  { href: '/contact', title: 'Contact', description: 'Reach the AlphaClone team.' },
];

export const metadata: Metadata = {
  title: 'Search | AlphaClone Systems',
  description: 'Search AlphaClone public pages, guides, and policy content.',
  alternates: { canonical: 'https://alphaclonesystems.com/search' },
  robots: { index: true, follow: true },
};

export default function Page({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const query = searchParams?.q || '';
  const q = String(query).trim().toLowerCase();
  const results = q
    ? SITE_PAGES.filter((page) =>
        [page.title, page.description, page.href].some((field) => field.toLowerCase().includes(q))
      )
    : SITE_PAGES.slice(0, 8);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-semibold text-white">Search AlphaClone</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
          Find product pages, onboarding help, and legal notices from one place.
        </p>

        <form action="/search" method="get" className="mt-8 flex gap-3">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search pages..."
            className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-slate-100 outline-none focus:border-teal-500"
          />
          <button type="submit" className="rounded-lg bg-teal-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-teal-400">
            Search
          </button>
        </form>

        <div className="mt-10 grid gap-4">
          {results.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 transition-colors hover:border-teal-500/30"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-teal-400">{page.href}</p>
              <h2 className="mt-2 text-xl font-semibold text-white">{page.title}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-400">{page.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
