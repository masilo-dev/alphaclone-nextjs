'use client';

import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  FolderKanban,
  Mail,
  Search,
  Share2,
  Users,
} from 'lucide-react';

const FIRST_WINS = [
  {
    title: 'Find potential customers',
    description: 'Describe the customers you want to reach and save useful results for later follow-up.',
    href: '/dashboard/leads/campaigns',
    Icon: Search,
  },
  {
    title: 'Post to social media',
    description: 'Write an update, review it, and publish it from a connected business account.',
    href: '/dashboard/business/social/compose',
    Icon: Share2,
  },
  {
    title: 'Send an email or promotion',
    description: 'Choose contacts, write a message, set the sender, review it, then send or schedule it.',
    href: '/dashboard/business/campaigns',
    Icon: Mail,
  },
  {
    title: 'Manage customer enquiries',
    description: 'Add a customer or enquiry, keep the conversation together, and set a follow-up.',
    href: '/dashboard/crm/workspace?quickAdd=true',
    Icon: Users,
  },
  {
    title: 'Create a quote or invoice',
    description: 'Prepare a draft bill for a customer and check it before sharing or sending it.',
    href: '/dashboard/business/billing/manage?create=true',
    Icon: FileText,
  },
  {
    title: 'Organize projects and tasks',
    description: 'Create the work you need to deliver and track what needs attention.',
    href: '/dashboard/business/projects/manage?create=true',
    Icon: FolderKanban,
  },
] as const;

const PLATFORM_AREAS = [
  { area: 'Dashboard', purpose: 'See what needs attention and choose a useful next action.', href: '/dashboard' },
  { area: 'Leads', purpose: 'Find and organize potential customers.', href: '/dashboard/leads/campaigns' },
  { area: 'Customers', purpose: 'Keep customer details, enquiries, and follow-ups together.', href: '/dashboard/crm/workspace' },
  { area: 'Projects', purpose: 'Manage work you deliver for customers.', href: '/dashboard/business/projects' },
  { area: 'Tasks', purpose: 'Plan and complete day-to-day work.', href: '/dashboard/tasks' },
  { area: 'Social', purpose: 'Create, review, and publish content.', href: '/dashboard/business/social' },
  { area: 'Messages', purpose: 'Handle customer conversations in one place.', href: '/dashboard/comms' },
  { area: 'Finance', purpose: 'Create quotes or invoices and monitor payment status.', href: '/dashboard/business/billing' },
] as const;

const STARTING_STEPS = [
  {
    number: '1',
    title: 'Create your account',
    description: 'Use your email and a secure password, or continue with a supported sign-in option. Confirm your email when prompted.',
  },
  {
    number: '2',
    title: 'Choose one business outcome',
    description: 'After sign-in, choose what would be most useful right now. This choice opens the relevant workspace; it does not limit your access to other tools.',
  },
  {
    number: '3',
    title: 'Complete one small action',
    description: 'For example, add one customer, create one invoice draft, or prepare one social post. You can return to the Dashboard at any time.',
  },
  {
    number: '4',
    title: 'Review before anything leaves AlphaClone',
    description: 'Messages, invoices, and social posts remain under your control. Check the recipient, sender, content, and timing before you choose to send or publish.',
  },
] as const;

/**
 * A practical public entry point. It mirrors the real, outcome-led dashboard
 * onboarding and only links to tenant-aware routes already implemented in the app.
 */
const PlatformGuide = () => (
  <main className="min-h-screen page-network-bg marketing-theme bg-transparent text-white">
    <section className="border-b border-slate-800/50 bg-gradient-to-b from-slate-900/70 to-slate-950/70 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl px-4">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-300">A practical guide for first-time teams</p>
        <h1 className="mt-4 max-w-4xl text-3xl font-bold leading-tight sm:text-5xl">
          Start with one useful thing for your business.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-slate-300">
          AlphaClone brings customer work, outreach, finance, projects, and everyday tasks into one workspace. You do not need to configure everything before you begin.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/auth/login?register=true"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-teal-500 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-teal-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-200"
          >
            Create an account <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <a
            href="#first-wins"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-teal-300 hover:bg-teal-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-200"
          >
            See what you can do first
          </a>
        </div>
      </div>
    </section>

    <section aria-labelledby="how-it-works" className="border-b border-slate-800/50 bg-slate-950/55 py-14 sm:py-16">
      <div className="mx-auto max-w-5xl px-4">
        <h2 id="how-it-works" className="text-2xl font-bold sm:text-3xl">What happens after you sign in</h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-slate-400">
          The first-use flow is deliberately short. It takes you to a useful place without asking you to complete a long business questionnaire.
        </p>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STARTING_STEPS.map((step) => (
            <li key={step.number} className="rounded-xl border border-slate-700/70 bg-white/[0.04] p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/15 text-sm font-bold text-teal-300">{step.number}</span>
              <h3 className="mt-4 font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>

    <section id="first-wins" aria-labelledby="first-wins-heading" className="bg-white/[0.02] py-14 sm:py-16">
      <div className="mx-auto max-w-5xl px-4">
        <h2 id="first-wins-heading" className="text-2xl font-bold sm:text-3xl">Choose your first win</h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-slate-400">
          Each option below opens an existing AlphaClone workspace. If you are not signed in, AlphaClone will ask you to sign in first and then continue safely.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FIRST_WINS.map(({ title, description, href, Icon }) => (
            <Link
              key={title}
              href={href}
              aria-label={`Open ${title}`}
              className="group rounded-xl border border-slate-700/70 bg-slate-950/60 p-5 transition-colors hover:border-teal-400/70 hover:bg-teal-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-teal-400/20 bg-teal-500/10 text-teal-300">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-300 group-hover:text-teal-100">
                Open this workspace <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>

    <section aria-labelledby="platform-map-heading" className="border-y border-slate-800/50 bg-slate-950/55 py-14 sm:py-16">
      <div className="mx-auto max-w-5xl px-4">
        <h2 id="platform-map-heading" className="text-2xl font-bold sm:text-3xl">Where to go in the platform</h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-slate-400">Use this map whenever you want a direct route without guessing a module name.</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {PLATFORM_AREAS.map((item) => (
            <Link
              key={item.area}
              href={item.href}
              aria-label={`Open ${item.area}`}
              className="group flex items-start gap-3 rounded-xl border border-slate-700/60 bg-white/[0.04] p-4 transition-colors hover:border-teal-400/60 hover:bg-teal-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-white">{item.area}</span>
                <span className="mt-1 block text-sm leading-relaxed text-slate-400">{item.purpose}</span>
              </span>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-teal-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </div>
    </section>

    <section aria-labelledby="safe-start-heading" className="py-14 sm:py-16">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div>
          <h2 id="safe-start-heading" className="text-2xl font-bold sm:text-3xl">A few useful safeguards</h2>
          <p className="mt-3 leading-relaxed text-slate-400">
            Good business software should make the next step clearer without taking important actions away from you. AlphaClone keeps review points visible as you work.
          </p>
        </div>
        <ul className="space-y-3 rounded-xl border border-teal-500/20 bg-teal-500/5 p-5">
          {[
            'Email campaigns require a recipient group and sender address before they can be sent.',
            'Social updates can be reviewed before publishing from a connected account.',
            'Quotes and invoices can be prepared as drafts before you share or send them.',
            'You can return to the Dashboard and change direction without losing access to other workspaces.',
          ].map((item) => (
            <li key={item} className="flex gap-3 text-sm leading-relaxed text-slate-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  </main>
);

export default PlatformGuide;
