import {
  ArrowRight,
  BarChart3,
  Bot,
  Calendar,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Mail,
  Megaphone,
  MessageSquare,
  Target,
  Users,
  Workflow,
} from 'lucide-react';
import { DEMO_HREF } from '@/lib/marketing/cta';
import { PrimaryCTA, SecondaryCTA } from './CtaButtons';
import { MarketingContainer, MarketingSection } from './LayoutPrimitives';
import MarketingShell from './MarketingShell';
import VerifiedIntegrationsStrip from './VerifiedIntegrationsStrip';
import {
  CurvedDotField,
  HeroDataWaves,
  SectionAmbientLight,
  SectionConnector,
} from './atmosphere';

const journeyStages = [
  {
    stage: 'ATTRACT',
    result: 'Reach potential customers.',
    capabilities: ['Marketing', 'Social publishing', 'Campaigns', 'Content', 'Lead generation'],
  },
  {
    stage: 'CAPTURE',
    result: 'Turn attention into identifiable opportunities.',
    capabilities: ['Lead capture', 'CRM', 'Forms', 'Customer records'],
  },
  {
    stage: 'CONVERT',
    result: 'Move opportunities toward a decision.',
    capabilities: ['CRM pipeline', 'Outreach', 'Email', 'Follow-ups', 'Calendar', 'Booking'],
  },
  {
    stage: 'DELIVER',
    result: 'Move from sale to execution.',
    capabilities: ['Documents', 'Projects', 'Customer communication', 'Operations'],
  },
  {
    stage: 'COLLECT',
    result: 'Turn completed work into revenue.',
    capabilities: ['Invoices', 'Payments', 'Money Hub', 'POS where applicable'],
  },
  {
    stage: 'RETAIN',
    result: 'Maintain the customer relationship.',
    capabilities: ['CRM history', 'Communication', 'Follow-ups', 'Customer records', 'Marketing'],
  },
  {
    stage: 'GROW',
    result: 'Understand what is working and repeat it.',
    capabilities: ['Reporting', 'Goals', 'Revenue analytics', 'Business intelligence', 'AI recommendations'],
  },
];

const opportunityFlow = [
  ['Marketing', 'A potential customer enters through a campaign.'],
  ['CRM', 'AlphaClone captures the opportunity with customer context intact.'],
  ['Outreach', 'Follow-up stays connected to the record.'],
  ['Calendar', 'A meeting is booked without losing the thread.'],
  ['Documents', 'The opportunity converts and work begins from the same context.'],
  ['Invoices', 'Completed work becomes a billable event.'],
  ['Money Hub', 'Payment is recorded and reflected in revenue.'],
  ['Reporting', 'The owner sees what changed in the business.'],
  ['Bonnie AI', 'AI understands the full journey and can recommend the next action.'],
];

const outcomeGroups = [
  {
    title: 'Get Customers',
    body: 'Create demand and bring new opportunities into the business record.',
    items: ['Marketing Hub', 'Social', 'Lead Generation', 'Campaigns', 'Outreach'],
    icon: Megaphone,
  },
  {
    title: 'Convert Customers',
    body: 'Keep conversations, timing and pipeline movement organized until a decision is made.',
    items: ['CRM', 'Communication', 'Email', 'Calendar', 'Booking'],
    icon: Users,
  },
  {
    title: 'Run the Work',
    body: 'Move from agreement to delivery with the customer, files and tasks still connected.',
    items: ['Documents', 'Workflows', 'Customer management', 'Operational tools'],
    icon: Workflow,
  },
  {
    title: 'Manage the Money',
    body: 'Connect completed work to invoices, payments and financial visibility.',
    items: ['Invoices', 'Payments', 'Money Hub', 'POS'],
    icon: CircleDollarSign,
  },
  {
    title: 'Understand the Business',
    body: 'See what is producing revenue, where work slows down and what deserves attention.',
    items: ['Reporting', 'Goals', 'Analytics', 'Business intelligence'],
    icon: BarChart3,
  },
  {
    title: 'Execute With AI',
    body: 'Let Bonnie work through shared business context instead of sitting beside it.',
    items: ['Bonnie AI', 'Nexus', 'Cross-module actions', 'Connected business context'],
    icon: Bot,
  },
];

const fragmentedCosts = [
  'Duplicate data',
  'Lost context',
  'Manual copying',
  'Missed follow-ups',
  'Multiple subscriptions',
  'Disconnected AI',
  'More administration',
  'Less actual business',
];

const businessValueQuestions = [
  'Does it help generate revenue?',
  'Does it save meaningful time?',
  'Does it improve conversion?',
  'Does it reduce unnecessary cost?',
  'Does it improve decision making?',
  'Does it improve customer experience?',
];

export default function MarketingHomePage() {
  return (
    <MarketingShell>
      <section className="mkt-hero mkt-hero--compact">
        <SectionAmbientLight variant="hero" />
        <HeroDataWaves />
        <CurvedDotField />
        <MarketingContainer>
          <div className="mkt-hero-copy mkt-reveal text-center max-w-4xl mx-auto">
            <p className="mkt-eyebrow mb-5">The Business Execution System</p>
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white mb-6 font-marketing-heading leading-tight">
              Run your business. Not your software.
            </h1>
            <p className="mkt-lead text-base sm:text-lg md:text-xl text-slate-300 max-w-3xl mx-auto mb-8 leading-relaxed">
              AlphaClone connects marketing, customers, sales, communication, payments and operations into one Business Execution System - with AI capable of working across it.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mb-10">
              <PrimaryCTA href={DEMO_HREF} className="w-full sm:w-auto mkt-btn-large">
                See AlphaClone in Action
              </PrimaryCTA>
              <SecondaryCTA href="#system" className="w-full sm:w-auto mkt-btn-large">
                Explore the System
              </SecondaryCTA>
            </div>
          </div>

          <div className="relative mx-auto max-w-6xl rounded-2xl border border-slate-700/70 bg-slate-950/90 shadow-2xl shadow-teal-950/30 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-rose-500" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="ml-2 hidden sm:inline">AlphaClone Command Center</span>
              </div>
              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-300">
                Live business movement
              </span>
            </div>
            <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="border-b border-slate-800 p-5 sm:p-6 lg:border-b-0 lg:border-r">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-teal-300">Today</p>
                    <h2 className="mt-1 text-xl font-bold text-white">Opportunity to revenue</h2>
                  </div>
                  <div className="rounded-lg bg-slate-900 px-3 py-2 text-right">
                    <p className="text-xs text-slate-400">Pipeline value</p>
                    <p className="text-lg font-bold text-white">$48,250</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {opportunityFlow.slice(0, 5).map(([label, detail], index) => (
                    <div key={label} className="flex gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-teal-500/10 text-xs font-bold text-teal-300">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">{label}</p>
                        <p className="text-xs leading-5 text-slate-400">{detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-5 sm:p-6">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['New leads', '+12', Target],
                    ['Follow-ups ready', '7', Mail],
                    ['Meetings booked', '4', Calendar],
                    ['Invoices paid', '$9.8k', CircleDollarSign],
                  ].map(([label, value, Icon]) => (
                    <div key={label as string} className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                      <Icon className="mb-3 h-5 w-5 text-teal-300" aria-hidden="true" />
                      <p className="text-2xl font-bold text-white">{value as string}</p>
                      <p className="text-xs text-slate-400">{label as string}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg border border-teal-500/30 bg-teal-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <Bot className="mt-1 h-5 w-5 shrink-0 text-teal-300" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-white">Bonnie is reviewing next actions</p>
                      <p className="mt-1 text-xs leading-5 text-slate-300">
                        Three leads have no reply after proposal. Draft follow-up, attach the proposal, and update CRM status.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-slate-400">
                  {['CRM synced', 'Payment posted', 'Report updated'].map((item) => (
                    <div key={item} className="rounded-md border border-slate-800 bg-slate-900 p-2">
                      <CheckCircle2 className="mx-auto mb-1 h-4 w-4 text-emerald-300" aria-hidden="true" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </MarketingContainer>
      </section>

      <SectionConnector variant="fade" />

      <MarketingSection id="system" atmosphere="platform">
        <MarketingContainer>
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <p className="mkt-eyebrow mb-4">From opportunity to revenue.</p>
            <h2 className="font-marketing-heading text-3xl font-extrabold text-white sm:text-5xl">
              One journey. One connected business system.
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-7">
            {journeyStages.map((item, index) => (
              <article key={item.stage} className="mkt-surface p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-teal-300">{item.stage}</span>
                  {index < journeyStages.length - 1 ? <ArrowRight className="h-4 w-4 text-slate-500" aria-hidden="true" /> : null}
                </div>
                <p className="min-h-12 text-sm font-semibold leading-5 text-white">{item.result}</p>
                <ul className="mt-4 space-y-1 text-xs leading-5 text-slate-400">
                  {item.capabilities.map((capability) => (
                    <li key={capability}>{capability}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection atmosphere="outcomes">
        <MarketingContainer>
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <p className="mkt-eyebrow mb-4">The problem</p>
              <h2 className="font-marketing-heading text-3xl font-extrabold text-white sm:text-5xl">
                Your business shouldn't need ten systems to complete one job.
              </h2>
              <p className="mt-5 text-base leading-7 text-slate-300">
                The enemy is fragmentation: work moves forward, but context gets trapped in separate apps, tabs and handoffs.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {fragmentedCosts.map((cost) => (
                  <span key={cost} className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300">
                    {cost}
                  </span>
                ))}
              </div>
            </div>
            <div className="mkt-surface-elevated p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                {['Social platform', 'lead form', 'spreadsheet', 'CRM', 'email', 'calendar', 'documents', 'invoicing', 'payment system', 'reporting', 'AI assistant'].map((tool, index) => (
                  <span key={tool} className="inline-flex items-center gap-2">
                    <span className="rounded-md bg-slate-950 px-2 py-1">{tool}</span>
                    {index < 10 ? <ArrowRight className="h-3 w-3 text-slate-600" aria-hidden="true" /> : null}
                  </span>
                ))}
              </div>
              <div className="mt-8 rounded-xl border border-teal-500/30 bg-teal-500/10 p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-teal-300">AlphaClone</p>
                <h3 className="mt-2 text-2xl font-bold text-white">One connected operational environment.</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Customer journey, business operations and AI execution share context instead of passing fragments between systems.
                </p>
              </div>
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection id="workflow-story" atmosphere="platform">
        <MarketingContainer>
          <div className="mb-10 max-w-3xl">
            <p className="mkt-eyebrow mb-4">Product in motion</p>
            <h2 className="font-marketing-heading text-3xl font-extrabold text-white sm:text-5xl">
              Watch one opportunity move through the business.
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {opportunityFlow.map(([label, detail], index) => (
              <article key={label} className="mkt-surface p-5">
                <span className="text-xs font-mono font-bold text-teal-300">{String(index + 1).padStart(2, '0')}</span>
                <h3 className="mt-3 text-lg font-bold text-white">{label}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
              </article>
            ))}
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection id="ai-engine" atmosphere="platform">
        <MarketingContainer>
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="mkt-eyebrow mb-4">Bonnie AI</p>
              <h2 className="font-marketing-heading text-3xl font-extrabold text-white sm:text-5xl">
                AI is more useful when it understands the business it's working inside.
              </h2>
              <p className="mt-5 text-base leading-7 text-slate-300">
                AI should not sit beside your business. It should work through it.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="mkt-surface p-5">
                <h3 className="text-lg font-bold text-white">Traditional AI</h3>
                <p className="mt-4 text-sm leading-6 text-slate-400">
                  User asks question - AI responds - user manually performs the work elsewhere.
                </p>
              </div>
              <div className="mkt-surface-elevated border-teal-500/30 p-5">
                <h3 className="text-lg font-bold text-white">AlphaClone</h3>
                <p className="mt-4 text-sm leading-6 text-slate-300">
                  User gives objective - AlphaClone understands business context - modules are accessed - work is executed - records are updated - results can be measured.
                </p>
              </div>
              {[
                '"Show me the leads we haven\'t followed up with and prepare the next outreach."',
                '"What generated revenue this month and where are we losing opportunities?"',
              ].map((command) => (
                <div key={command} className="rounded-lg border border-slate-800 bg-slate-950 p-4 md:col-span-2">
                  <MessageSquare className="mb-3 h-5 w-5 text-teal-300" aria-hidden="true" />
                  <p className="text-sm font-semibold leading-6 text-white">{command}</p>
                  <p className="mt-2 text-xs text-slate-400">CRM, communication, reporting and Money Hub contribute context.</p>
                </div>
              ))}
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection id="platform" atmosphere="outcomes">
        <MarketingContainer>
          <div className="mb-10 max-w-3xl">
            <p className="mkt-eyebrow mb-4">Outcomes before modules</p>
            <h2 className="font-marketing-heading text-3xl font-extrabold text-white sm:text-5xl">
              Capabilities organized around business results.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {outcomeGroups.map(({ title, body, items, icon: Icon }) => (
              <article key={title} className="mkt-feature-card">
                <div className="mkt-feature-card-head">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-teal-500/30 bg-teal-500/10 text-teal-300">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3>{title}</h3>
                </div>
                <p>{body}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {items.map((item) => (
                    <span key={item} className="rounded-md bg-slate-950 px-2 py-1 text-xs text-slate-400">
                      {item}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection atmosphere="how">
        <MarketingContainer>
          <div className="mkt-surface-elevated p-6 sm:p-8">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
              <div>
                <p className="mkt-eyebrow mb-4">Operating principle</p>
                <h2 className="font-marketing-heading text-3xl font-extrabold text-white sm:text-5xl">
                  Technology isn't the product. Business improvement is.
                </h2>
              </div>
              <div>
                <p className="rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-sm leading-7 text-teal-200">
                  Business Value = (Useful Output x Probability of Success x Adoption x Scale) - Cost - Complexity - Risk
                </p>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {businessValueQuestions.map((question) => (
                    <div key={question} className="flex items-start gap-2 text-sm text-slate-300">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                      <span>{question}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection id="integrations" atmosphere="trust">
        <MarketingContainer>
          <div className="mx-auto mb-8 max-w-3xl text-center">
            <p className="mkt-eyebrow mb-4">Integrations</p>
            <h2 className="font-marketing-heading text-3xl font-extrabold text-white sm:text-5xl">
              Keep the tools that matter. Remove the fragmentation.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              AlphaClone connects with external services when they are useful while remaining the operational center of the business.
            </p>
          </div>
          <VerifiedIntegrationsStrip />
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection atmosphere="outcomes">
        <MarketingContainer>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <p className="mkt-eyebrow mb-4">Who it is for</p>
              <h2 className="font-marketing-heading text-3xl font-extrabold text-white">
                Built for businesses where execution matters more than software administration.
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
              {['Small businesses', 'Founder-led companies', 'Sole founders', 'Growing service businesses', 'Small teams', 'Businesses moving from manual processes toward digital operations'].map((audience) => (
                <div key={audience} className="mkt-surface p-4 text-sm font-semibold text-white">
                  {audience}
                </div>
              ))}
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection id="comparison" atmosphere="platform">
        <MarketingContainer>
          <div className="grid gap-4 md:grid-cols-2">
            <article className="mkt-surface p-6">
              <h2 className="text-2xl font-bold text-white">Fragmented Stack</h2>
              <ul className="mt-5 space-y-3 text-sm text-slate-400">
                {['Many subscriptions', 'Multiple logins', 'Data duplicated between systems', 'AI without complete context', 'Manual handoffs', 'Separate reporting', 'More administration'].map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-rose-300" />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
            <article className="mkt-surface-elevated border-teal-500/30 p-6">
              <h2 className="text-2xl font-bold text-white">AlphaClone</h2>
              <ul className="mt-5 space-y-3 text-sm text-slate-300">
                {['Connected customer journey', 'Shared business context', 'Central operations', 'Cross-module AI', 'Unified reporting', 'Fewer manual handoffs', 'Measurable execution'].map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection atmosphere="cta">
        <MarketingContainer>
          <div className="mx-auto max-w-4xl text-center">
            <ClipboardList className="mx-auto mb-5 h-10 w-10 text-teal-300" aria-hidden="true" />
            <h2 className="font-marketing-heading text-3xl font-extrabold text-white sm:text-5xl">
              Your business already has enough work.
            </h2>
            <p className="mt-4 text-xl font-semibold text-slate-200">Your software shouldn't create more of it.</p>
            <p className="mt-4 text-base text-slate-300">Run your business through one connected execution system.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <PrimaryCTA href={DEMO_HREF} className="w-full sm:w-auto mkt-btn-large">
                See AlphaClone in Action
              </PrimaryCTA>
              <SecondaryCTA href={DEMO_HREF} className="w-full sm:w-auto mkt-btn-large">
                Request a Demo
              </SecondaryCTA>
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>
    </MarketingShell>
  );
}
