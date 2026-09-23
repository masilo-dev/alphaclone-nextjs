'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, FileText, FolderKanban, Mail, Search, Share2, Users } from 'lucide-react';

const FIRST_WINS = [
  { title: 'Find potential customers', description: 'Describe the customers you want to reach and save useful results for later follow-up.', href: '/dashboard/leads/campaigns', Icon: Search },
  { title: 'Post to social media', description: 'Write an update, review it, and publish it from a connected business account.', href: '/dashboard/business/social/compose', Icon: Share2 },
  { title: 'Send an email or promotion', description: 'Choose contacts, write a message, set the sender, review it, then send or schedule it.', href: '/dashboard/business/campaigns', Icon: Mail },
  { title: 'Manage customer enquiries', description: 'Add a customer or enquiry, keep the conversation together, and set a follow-up.', href: '/dashboard/crm/workspace?quickAdd=true', Icon: Users },
  { title: 'Create a quote or invoice', description: 'Prepare a draft bill for a customer and check it before sharing or sending it.', href: '/dashboard/business/billing/manage?create=true', Icon: FileText },
  { title: 'Organize projects and tasks', description: 'Create the work you need to deliver and track what needs attention.', href: '/dashboard/business/projects/manage?create=true', Icon: FolderKanban },
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
  { number: '1', title: 'Create your account', description: 'Use your email and a secure password, or continue with a supported sign-in option. Confirm your email when prompted.' },
  { number: '2', title: 'Choose one business outcome', description: 'After sign-in, choose what would be most useful right now. This choice opens the relevant workspace; it does not limit access to other tools.' },
  { number: '3', title: 'Complete one small action', description: 'For example, add one customer, create one invoice draft, or prepare one social post. You can return to the Dashboard at any time.' },
  { number: '4', title: 'Review before anything leaves AlphaClone', description: 'Messages, invoices, and social posts remain under your control. Check the recipient, sender, content, and timing before sending or publishing.' },
] as const;

/** Practical public entry point for the outcome-led first-use journey. */
const PlatformGuide = () => (
  <main className="min-h-screen page-network-bg marketing-theme bg-transparent text-white">
    <section className="relative overflow-hidden border-b border-slate-800/50 bg-gradient-to-br from-slate-900 via-slate-950 to-[#071f2a] py-16 sm:py-24">
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl" aria-hidden="true" />
      <div className="mx-auto grid max-w-5xl gap-12 px-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="inline-flex items-center rounded-full border border-teal-500 bg-teal-700 px-3 py-1 type-caption font-bold uppercase tracking-caps text-white">A practical guide for first-time teams</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">Start with one useful thing for your business.</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">AlphaClone brings customer work, outreach, finance, projects, and everyday tasks into one workspace. You do not need to configure everything before you begin.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/auth/login?register=true" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-teal-500 px-5 py-3 type-ui font-semibold text-slate-950 transition-colors hover:bg-teal-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-200">Create an account <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            <a href="#first-wins" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-600 px-5 py-3 type-ui font-semibold text-white transition-colors hover:border-teal-300 hover:bg-teal-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-200">See what you can do first</a>
          </div>
          <p className="mt-5 type-ui text-slate-300">Choose a direction now. Change it later without losing access to the rest of your workspace.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 backdrop-blur-sm sm:p-6">
          <p className="type-caption font-semibold uppercase tracking-caps text-teal-300">Your first session</p>
          <div className="mt-5 space-y-4">
            {STARTING_STEPS.slice(0, 3).map((step, index) => (
              <div key={step.number} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-400/15 type-caption font-bold text-teal-200">{step.number}</span>
                <div><p className="type-card-description font-semibold text-white">{step.title}</p><p className="mt-1 type-ui leading-relaxed text-slate-300">{index === 0 ? 'Confirm your email and enter your workspace.' : index === 1 ? 'Tell AlphaClone what matters most right now.' : 'Complete one small action and see the result.'}</p></div>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-white/10 pt-4 type-caption text-slate-400"><span className="font-semibold text-teal-300">Always in control:</span> review messages, invoices, and posts before they leave AlphaClone.</div>
        </div>
      </div>
    </section>

    <section aria-labelledby="how-it-works" className="border-b border-slate-800/50 bg-slate-950/55 py-12 sm:py-14">
      <div className="mx-auto max-w-5xl px-4">
        <h2 id="how-it-works" className="text-2xl font-bold sm:text-3xl">What happens after you sign in</h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-slate-400">The first-use flow is deliberately short. It takes you to a useful place without asking you to complete a long business questionnaire.</p>
        <ol className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STARTING_STEPS.map((step) => <li key={step.number} className="rounded-xl border border-slate-700/70 bg-white/[0.035] p-4 transition-colors hover:border-teal-400/40"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/15 type-card-description font-bold text-teal-300">{step.number}</span><h3 className="mt-3 font-semibold text-white">{step.title}</h3><p className="mt-2 type-card-description leading-relaxed text-slate-400">{step.description}</p></li>)}
        </ol>
      </div>
    </section>

    <section id="first-wins" aria-labelledby="first-wins-heading" className="bg-white/[0.02] py-14 sm:py-20">
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="type-caption font-semibold uppercase tracking-caps text-teal-300">Pick a starting point</p><h2 id="first-wins-heading" className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Choose your first win</h2></div><p className="max-w-md type-card-description text-slate-400 sm:text-right">Each option opens an existing workspace. If you are not signed in, AlphaClone will ask you to sign in first and continue safely.</p></div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FIRST_WINS.map(({ title, description, href, Icon }) => <Link key={title} href={href} aria-label={`Open ${title}`} className="group flex min-h-[190px] flex-col rounded-2xl border border-slate-700/70 bg-slate-950/70 p-5 shadow-lg shadow-black/10 transition-all hover:-translate-y-0.5 hover:border-teal-400/70 hover:bg-teal-500/10 hover:shadow-teal-950/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"><span className="flex h-10 w-10 items-center justify-center rounded-lg border border-teal-400/20 bg-teal-500/10 text-teal-300"><Icon className="h-5 w-5" aria-hidden="true" /></span><h3 className="mt-4 text-base font-semibold text-white">{title}</h3><p className="mt-2 type-ui leading-relaxed text-slate-400">{description}</p><span className="mt-auto inline-flex items-center gap-1.5 pt-5 type-ui font-semibold text-teal-300 group-hover:text-teal-100">Open this workspace <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span></Link>)}
        </div>
      </div>
    </section>

    <section aria-labelledby="platform-map-heading" className="border-y border-slate-800/50 bg-slate-950/55 py-12 sm:py-14">
      <div className="mx-auto max-w-5xl px-4"><p className="type-caption font-semibold uppercase tracking-caps text-slate-500">When you need another area</p><h2 id="platform-map-heading" className="mt-2 text-2xl font-bold sm:text-3xl">Where to go in the platform</h2><p className="mt-3 max-w-3xl leading-relaxed text-slate-400">Use this map whenever you want a direct route without guessing a module name.</p><div className="mt-7 grid gap-3 sm:grid-cols-2">{PLATFORM_AREAS.map((item) => <Link key={item.area} href={item.href} aria-label={`Open ${item.area}`} className="group flex items-start gap-3 rounded-xl border border-slate-700/60 bg-white/[0.04] p-4 transition-colors hover:border-teal-400/60 hover:bg-teal-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"><span className="min-w-0 flex-1"><span className="block font-semibold text-white">{item.area}</span><span className="mt-1 block type-ui leading-relaxed text-slate-400">{item.purpose}</span></span><ArrowRight className="mt-1 h-4 w-4 shrink-0 text-teal-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></Link>)}</div></div>
    </section>

    <section aria-labelledby="safe-start-heading" className="py-12 sm:py-14"><div className="mx-auto grid max-w-5xl gap-8 px-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-start"><div><p className="type-caption font-semibold uppercase tracking-caps text-slate-500">Built for confident action</p><h2 id="safe-start-heading" className="mt-2 text-2xl font-bold sm:text-3xl">A few useful safeguards</h2><p className="mt-3 leading-relaxed text-slate-400">Good business software should make the next step clearer without taking important actions away from you.</p></div><ul className="space-y-3 rounded-xl border border-teal-500/20 bg-teal-500/5 p-5">{['Email campaigns require a recipient group and sender address before they can be sent.','Social updates can be reviewed before publishing from a connected account.','Quotes and invoices can be prepared as drafts before you share or send them.','You can return to the Dashboard and change direction without losing access to other workspaces.'].map((item) => <li key={item} className="flex gap-3 type-ui leading-relaxed text-slate-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" aria-hidden="true" />{item}</li>)}</ul></div></section>
  </main>
);

export default PlatformGuide;
