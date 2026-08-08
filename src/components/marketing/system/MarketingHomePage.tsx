"use client";

import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Layers,
  Megaphone,
  ShieldCheck,
  Target,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import { DEMO_HREF, TRIAL_HREF } from "@/lib/marketing/cta";
import { PrimaryCTA, SecondaryCTA } from "./CtaButtons";
import { MarketingContainer, MarketingSection } from "./LayoutPrimitives";
import MarketingShell from "./MarketingShell";
import VerifiedIntegrationsStrip from "./VerifiedIntegrationsStrip";
import {
  CurvedDotField,
  HeroDataWaves,
  SectionAmbientLight,
  SectionConnector,
} from "./atmosphere";

const problemPoints = [
  "Lost context",
  "Manual work",
  "Missed follow-ups",
  "Too many subscriptions",
];

const disconnectedTools = [
  "Social platform",
  "Lead form",
  "Spreadsheet",
  "CRM",
  "Email",
  "Calendar",
  "Documents",
  "Invoicing",
  "Payment system",
  "Reporting",
  "Standalone chatbot",
];

const outcomes = [
  {
    title: "Fewer handoffs",
    body: "Customer context moves with the work from lead capture to final billing.",
    icon: Layers,
  },
  {
    title: "Less manual work",
    body: "Routine operational actions move across connected modules automatically.",
    icon: Zap,
  },
  {
    title: "Faster follow-up",
    body: "Opportunities don't disappear or cool off between separate tools.",
    icon: Target,
  },
  {
    title: "One operational view",
    body: "Sales, communication, money, and delivery stay visible in one place.",
    icon: BarChart3,
  },
];

const capabilities = [
  {
    title: "Acquire",
    items: [
      "Lead discovery",
      "Lead qualification",
      "CRM",
      "Outreach",
      "Marketing",
      "Social publishing",
    ],
    icon: Megaphone,
  },
  {
    title: "Convert",
    items: ["CRM pipeline", "Outreach", "Calendar", "Contact history"],
    icon: Users,
  },
  {
    title: "Operate",
    items: ["Bonnie AI", "Tasks", "Communication", "Automation"],
    icon: ShieldCheck,
  },
  {
    title: "Deliver",
    items: ["Projects", "Documents", "Contracts", "Client information"],
    icon: Workflow,
  },
  {
    title: "Get Paid",
    items: ["Invoices", "Money Hub", "Revenue tracking", "Business reporting"],
    icon: CircleDollarSign,
  },
];

export default function MarketingHomePage() {
  return (
    <MarketingShell>
      <section className="mkt-hero mkt-hero--compact pt-24 sm:pt-28 lg:pt-32 pb-10 sm:pb-14">
        <SectionAmbientLight variant="hero" />
        <HeroDataWaves />
        <CurvedDotField />
        <MarketingContainer>
          <div className="mkt-hero-copy mkt-reveal mx-auto max-w-4xl px-2 text-center">
            <h1 className="font-marketing-heading text-3xl font-extrabold leading-[1.08] tracking-normal text-white sm:text-5xl md:text-6xl">
              <span>Run your business from </span>
              <span className="block bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
                one AI workspace.
              </span>
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base md:text-lg">
              Find customers. Manage relationships. Deliver work. Send invoices.
              Let Bonnie handle the repetitive work between them.
            </p>

            <div className="mx-auto mt-7 flex max-w-md flex-col items-stretch justify-center gap-3 sm:max-w-none sm:flex-row sm:items-center">
              <PrimaryCTA
                href={TRIAL_HREF}
                className="w-full sm:w-auto mkt-btn-large"
              >
                Start for $15/month
              </PrimaryCTA>
              <SecondaryCTA
                href={DEMO_HREF}
                className="w-full sm:w-auto mkt-btn-large"
              >
                See how it works
              </SecondaryCTA>
            </div>
          </div>

          <div className="mkt-reveal mx-auto mt-8 max-w-[92vw] sm:max-w-3xl lg:max-w-5xl">
            <div className="overflow-hidden rounded-[1.75rem] border border-white/15 bg-white shadow-2xl shadow-teal-950/20">
              <Image
                src="/images/alphaclone-all-in-one-mcp-platform.png"
                alt="AlphaClone all-in-one platform dashboard with connected tools and business workspace"
                width={1024}
                height={682}
                priority
                sizes="(max-width: 640px) 92vw, (max-width: 1024px) 768px, 1024px"
                className="h-auto w-full"
              />
            </div>
          </div>
        </MarketingContainer>
      </section>

      <SectionConnector variant="fade" />

      <MarketingSection atmosphere="outcomes" className="py-12 sm:py-16">
        <MarketingContainer>
          <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5">
              <span className="text-xs font-bold uppercase tracking-widest text-teal-400">
                The Problem
              </span>
              <h2 className="mt-3 font-marketing-heading text-2xl font-extrabold leading-tight text-white sm:text-4xl">
                Your business shouldn't need ten systems to complete one job.
              </h2>
              <p className="mt-4 text-sm leading-6 text-slate-300 sm:text-base">
                The enemy is fragmentation: work moves forward, but context gets
                trapped in separate apps, tabs and handoffs.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2">
                {problemPoints.map((point) => (
                  <div
                    key={point}
                    className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200"
                  >
                    {point}
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="grid gap-4 md:grid-cols-[1fr_0.9fr]">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/65 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-white">
                      Fragmented Stack
                    </h3>
                    <span className="text-[11px] font-semibold text-rose-300">
                      11 disconnected tools
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {disconnectedTools.map((tool) => (
                      <span
                        key={tool}
                        className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-[11px] text-slate-300"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-teal-500/30 bg-teal-500/10 p-5">
                  <h3 className="text-sm font-bold text-teal-200">
                    The AlphaClone Contrast
                  </h3>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-emerald-300">
                    Connected Execution
                  </p>
                  <div className="mt-5 space-y-3 text-xs font-bold text-white">
                    <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                      One opportunity
                    </div>
                    <ArrowRight className="mx-auto h-4 w-4 rotate-90 text-teal-300" />
                    <div className="rounded-xl bg-teal-400 px-3 py-2 text-center text-slate-950">
                      AlphaClone
                    </div>
                    <ArrowRight className="mx-auto h-4 w-4 rotate-90 text-teal-300" />
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-center text-emerald-200">
                      Revenue
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection
        id="bonnie"
        atmosphere="platform"
        className="py-12 sm:py-16"
      >
        <MarketingContainer>
          <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5">
              <span className="text-xs font-bold uppercase tracking-widest text-teal-400">
                Bonnie Coordination
              </span>
              <h2 className="mt-3 font-marketing-heading text-2xl font-extrabold leading-tight text-white sm:text-4xl">
                Bonnie works with the operating system, not beside it.
              </h2>
              <p className="mt-4 text-sm leading-6 text-slate-300 sm:text-base">
                Ask for twenty potential customers, unpaid invoice follow-ups,
                or tomorrow's delivery risks. Bonnie researches, prepares
                records, drafts messages and queues actions for review across
                the connected workspace.
              </p>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl sm:p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                    <p className="text-xs font-bold text-slate-300">
                      Standalone Chat
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      User asks. Answer appears. Manual work happens somewhere
                      else.
                    </p>
                  </div>
                  <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-4">
                    <p className="text-xs font-bold text-teal-200">
                      AlphaClone Bonnie
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-300">
                      Request comes in. Records, tasks, outreach and approvals
                      are prepared in the right modules.
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" />
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        "Find 20 potential customers and prepare outreach."
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-slate-300">
                        Bonnie turns that request into lead records, scores, CRM
                        updates, drafts and follow-up tasks.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                    {[
                      "Discover prospects from public business data",
                      "Score fit and create qualified lead records",
                      "Prepare outreach for owner approval",
                      "Create follow-up tasks in the CRM timeline",
                    ].map((action) => (
                      <div
                        key={action}
                        className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                      >
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                        <span>{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection atmosphere="outcomes" className="py-12 sm:py-16">
        <MarketingContainer>
          <div className="mx-auto mb-9 max-w-3xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-teal-400">
              Business Outcomes
            </span>
            <h2 className="mt-2 font-marketing-heading text-2xl font-extrabold text-white sm:text-4xl">
              One system. Less operational drag.
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {outcomes.map((outcome) => {
              const Icon = outcome.icon;
              return (
                <article
                  key={outcome.title}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
                >
                  <Icon className="h-5 w-5 text-teal-300" />
                  <h3 className="mt-4 text-base font-bold text-white">
                    {outcome.title}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-slate-300">
                    {outcome.body}
                  </p>
                </article>
              );
            })}
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection
        id="platform"
        atmosphere="platform"
        className="py-12 sm:py-16"
      >
        <MarketingContainer>
          <div className="mx-auto mb-9 max-w-3xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-teal-400">
              Capabilities
            </span>
            <h2 className="mt-2 font-marketing-heading text-2xl font-extrabold text-white sm:text-4xl">
              Capabilities grouped by business outcome.
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {capabilities.map((capability) => {
              const Icon = capability.icon;
              return (
                <article
                  key={capability.title}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
                >
                  <Icon className="h-5 w-5 text-slate-300" />
                  <h3 className="mt-4 text-sm font-bold text-white">
                    {capability.title}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {capability.items.map((item) => (
                      <span
                        key={item}
                        className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-300"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection atmosphere="trust" className="py-12 sm:py-16">
        <MarketingContainer>
          <div className="mx-auto max-w-4xl text-center">
            <ShieldCheck className="mx-auto h-7 w-7 text-teal-300" />
            <h2 className="mt-4 font-marketing-heading text-2xl font-extrabold text-white sm:text-4xl">
              Your business data deserves serious infrastructure.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              AlphaClone keeps core controls visible: OAuth connection
              management, privacy settings, export and deletion flows, DPA
              terms, service status and human approval for sensitive AI actions.
            </p>
            <div className="mt-7">
              <VerifiedIntegrationsStrip />
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection atmosphere="cta" className="py-14 sm:py-20">
        <MarketingContainer>
          <div className="mx-auto max-w-3xl px-4 text-center">
            <h2 className="font-marketing-heading text-3xl font-extrabold leading-tight text-white sm:text-5xl">
              Start with the connected business OS for $15/month.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              Built for founders and small service teams that have outgrown
              spreadsheets but don't want ten different platforms.
            </p>
            <div className="mx-auto mt-8 flex max-w-md flex-col items-stretch justify-center gap-3 sm:max-w-none sm:flex-row sm:items-center">
              <PrimaryCTA
                href={TRIAL_HREF}
                className="w-full sm:w-auto mkt-btn-large"
              >
                Start for $15/month
              </PrimaryCTA>
              <SecondaryCTA
                href={DEMO_HREF}
                className="w-full sm:w-auto mkt-btn-large"
              >
                See how it works
              </SecondaryCTA>
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>
    </MarketingShell>
  );
}
