"use client";

import Image from "next/image";
import Link from "next/link";
import type { IconType } from "react-icons";
import { FaFacebook, FaLinkedin, FaMicrosoft, FaSlack, FaWhatsapp } from "react-icons/fa6";
import { SiBrevo, SiCalendly, SiGmail, SiHubspot, SiQuickbooks, SiResend, SiStripe, SiZapier, SiZoho } from "react-icons/si";
import { Check, ChevronRight, CircleDollarSign, Clock3, Database, FileCheck2, FileText, LockKeyhole, Mail, ReceiptText, Search, Send, ShieldCheck, UserRoundCheck, Users, WalletCards } from "lucide-react";
import { DEMO_HREF, TRIAL_HREF } from "@/lib/marketing/cta";
import { PrimaryCTA, SecondaryCTA } from "./CtaButtons";
import { MarketingContainer, MarketingSection } from "./LayoutPrimitives";
import MarketingShell from "./MarketingShell";
import LookInsideAlphaClone from "./LookInsideAlphaClone";
import AiInterfaceShowcase from "./AiInterfaceShowcase";
import LifecycleFlowShowcase from "./LifecycleFlowShowcase";

type Integration = { name: string; detail: string; icon: IconType; color: string };
const executionRows = [
  ["Research prospects", "20 / 20 found", "Done", "done", "09:42"],
  ["Check fit", "Industry · size · web · location", "Done", "done", "09:44"],
  ["Create CRM records", "20 records created", "Done", "done", "09:46"],
  ["Prepare outreach", "14 / 20 drafts prepared", "In progress", "active", "Now"],
  ["Schedule follow-up", "Waiting for outreach approval", "Queued", "queued", "Next"],
  ["Owner approval", "6 actions require review", "Needs approval", "approval", "Review"],
] as const;

const integrationGroups: Array<{ title: string; items: Integration[] }> = [
  { title: "Communication & Email", items: [
    { name: "Outlook 365", detail: "Inbox sync & email delivery", icon: FaMicrosoft, color: "#0078d4" },
    { name: "Google Gmail", detail: "Read & send email threads", icon: SiGmail, color: "#ea4335" },
    { name: "Zoho Mail", detail: "Mailbox & reply tracking", icon: SiZoho, color: "#f6c344" },
    { name: "WhatsApp", detail: "Customer messaging & alerts", icon: FaWhatsapp, color: "#25d366" },
    { name: "Brevo", detail: "Email outreach & campaigns", icon: SiBrevo, color: "#0092ff" },
    { name: "Resend", detail: "Automated transactional mail", icon: SiResend, color: "#ffffff" },
  ]},
  { title: "CRM, Sales & Scheduling", items: [
    { name: "Zoho CRM", detail: "Contacts, deals & accounts", icon: SiZoho, color: "#f6c344" },
    { name: "LinkedIn", detail: "Profile research & outreach", icon: FaLinkedin, color: "#0a66c2" },
    { name: "HubSpot", detail: "Pipeline & lead sync", icon: SiHubspot, color: "#ff7a59" },
    { name: "Calendly", detail: "Meeting booking & scheduling", icon: SiCalendly, color: "#006bfc" },
  ]},
  { title: "Financials & Payments", items: [
    { name: "Stripe", detail: "Payments & subscriptions", icon: SiStripe, color: "#635bff" },
    { name: "QuickBooks", detail: "Accounting & ledger sync", icon: SiQuickbooks, color: "#2ca01c" },
  ]},
  { title: "Social & Productivity", items: [
    { name: "Facebook Pages", detail: "Post publishing & lead forms", icon: FaFacebook, color: "#1877f2" },
    { name: "LinkedIn Pages", detail: "Company updates & stats", icon: FaLinkedin, color: "#0a66c2" },
    { name: "Slack", detail: "Internal alerts & notifications", icon: FaSlack, color: "#e01e5a" },
    { name: "Zapier", detail: "Multi-app trigger automation", icon: SiZapier, color: "#ff4a00" },
  ]},
];

function Intro({ eyebrow, title, body, center = false }: { eyebrow?: string; title: string; body?: string; center?: boolean }) {
  return <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
    {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[.22em] text-slate-400">{eyebrow}</p>}
    <h2 className="mt-3 font-marketing-heading text-2xl font-extrabold leading-[1.08] text-white sm:text-4xl lg:text-[44px]">{title}</h2>
    {body && <p className="mt-4 text-sm leading-6 text-slate-300 sm:text-base">{body}</p>}
  </div>;
}

function Status({ tone, children }: { tone: "done" | "active" | "queued" | "approval"; children: React.ReactNode }) {
  const s = {
    done: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
    active: "border-cyan-500/30 bg-cyan-500/5 text-cyan-200",
    queued: "border-slate-700 bg-slate-800/70 text-slate-300",
    approval: "border-amber-500/30 bg-amber-500/5 text-amber-300",
  };
  return <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold ${s[tone]}`}>{children}</span>;
}

export default function MarketingHomePage() {
  return <MarketingShell>
    {/* Approved hero — screenshots and approved copy preserved. */}
    <section className="mkt-hero mkt-hero--compact pt-24 sm:pt-28 lg:pt-32 pb-10 sm:pb-14">
      <MarketingContainer>
        <div className="mkt-hero-copy mkt-reveal mx-auto max-w-4xl px-2 text-center">
          <h1 className="font-marketing-heading text-3xl font-extrabold leading-[1.08] tracking-normal text-white sm:text-5xl md:text-6xl">
            Run your business from one connected workspace.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base md:text-lg">Find customers. Manage relationships. Deliver work. Send invoices. Let Bonnie handle the repetitive work between them.</p>
          <div className="mx-auto mt-7 flex max-w-md flex-col items-stretch justify-center gap-3 sm:max-w-none sm:flex-row sm:items-center sm:justify-center">
            <PrimaryCTA href={TRIAL_HREF} className="w-full sm:w-auto mkt-btn-large">Start for $15/month</PrimaryCTA>
            <SecondaryCTA href={DEMO_HREF} className="w-full sm:w-auto mkt-btn-large">Book a demo</SecondaryCTA>
          </div>
        </div>
        <div className="mkt-reveal mx-auto mt-8 max-w-[90vw] sm:max-w-2xl lg:max-w-4xl xl:max-w-[880px]">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#030a16] p-2 sm:p-3 shadow-2xl shadow-slate-950/40">
            <div className="mb-2 flex items-center justify-between border-b border-white/5 px-3 pb-2 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70"/>
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70"/>
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70"/>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-white/5 bg-slate-900/70 px-3 py-0.5 text-[10px] font-medium text-slate-400">
                <LockKeyhole className="h-2.5 w-2.5 text-slate-400"/>
                <span>alphaclone.app</span>
              </div>
              <div className="w-10"/>
            </div>
            <div className="overflow-hidden rounded-xl border border-white/5 bg-slate-950 select-none">
              <Image src="/images/alphaclone-all-in-one-mcp-platform.png" alt="AlphaClone all-in-one platform dashboard with connected tools and business workspace" width={1024} height={682} priority draggable={false} sizes="(max-width: 640px) 90vw, (max-width: 1024px) 672px, 880px" className="h-auto w-full max-w-full pointer-events-none select-none" />
            </div>
          </div>
        </div>
      </MarketingContainer>
    </section>

    {/* Interactive Look Inside AlphaClone (Tabs, Slider, Disclosures, Metrics) */}
    <MarketingSection id="look-inside" atmosphere="platform" className="py-10 sm:py-16 lg:py-24 border-t border-white/10">
      <LookInsideAlphaClone />
    </MarketingSection>

    {/* The Problem Section */}
    <MarketingSection atmosphere="outcomes" className="py-10 sm:py-16 lg:py-24"><MarketingContainer>
      <Intro eyebrow="The problem" title="One customer. Eleven tabs. Half the context missing." body="A lead starts in one tool. The conversation happens somewhere else. The quote becomes a document. Delivery moves into another system. The invoice lives somewhere else again." />
      <div className="mt-6 flex flex-wrap gap-2">
        {["Lost context","Manual follow-up","Scattered records","Too many subscriptions"].map(x=>(
          <div key={x} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400/80"/>
            <span>{x}</span>
          </div>
        ))}
      </div>
      <div className="mt-8 grid overflow-hidden rounded-2xl border border-slate-800 bg-[#030b19] shadow-2xl lg:grid-cols-2">
        <div className="border-b border-slate-800 p-5 sm:p-7 lg:border-b-0 lg:border-r lg:border-slate-800">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-400/90"/>
              <h3 className="text-sm font-semibold tracking-wide text-white">Fragmented stack</h3>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Context breaks at every handoff</span>
          </div>
          <div className="mt-5 space-y-2.5">
            {[[FaMicrosoft,"Outlook","Email conversation","#0078d4"],[SiZoho,"Zoho CRM","Customer record","#f6c344"],[SiCalendly,"Calendly","Meeting","#006bfc"],[FileText,"Google Sheets","Lead tracking","#34a853"],[SiStripe,"Stripe","Payment","#635bff"],[FaLinkedin,"LinkedIn","Outreach","#0a66c2"]].map(([Icon,name,detail,color],i)=>(
              <div key={String(name)} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-md border border-slate-800 bg-slate-950/80">
                    <Icon className="h-4 w-4" style={{color:String(color)}}/>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{String(name)}</p>
                    <p className="text-[10px] text-slate-400">{String(detail)}</p>
                  </div>
                </div>
                {i<5&&<span className="rounded-md border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[9px] font-semibold text-slate-400">disconnected</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="relative p-5 sm:p-7">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-400/90"/>
              <h3 className="text-sm font-semibold tracking-wide text-white">AlphaClone connected execution</h3>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Single source of truth</span>
          </div>
          <div className="relative mt-5 space-y-2.5">
            <div className="absolute bottom-6 left-[23px] top-4 w-px bg-slate-700"/>
            {[[Users,"Lead","Qualified"],[Database,"CRM record","Context attached"],[Send,"Outreach","Sent"],[Clock3,"Follow-up","Due tomorrow"],["Briefcase" as unknown as IconType,"Project","Active"],[ReceiptText,"Invoice","Sent"],[WalletCards,"Payment / Revenue","Paid"]].map(([Icon,name,status], idx)=>(
              <div key={String(name)} className="group relative flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 pl-3">
                <div className="flex items-center gap-3">
                  <span className="z-10 grid h-8 w-8 shrink-0 place-items-center rounded-md border border-slate-700 bg-slate-900 text-slate-300">
                    {idx === 0 ? <Users className="h-4 w-4"/> :
                     idx === 1 ? <Database className="h-4 w-4"/> :
                     idx === 2 ? <Send className="h-4 w-4"/> :
                     idx === 3 ? <Clock3 className="h-4 w-4"/> :
                     idx === 4 ? <Search className="h-4 w-4"/> :
                     idx === 5 ? <ReceiptText className="h-4 w-4"/> :
                     <CircleDollarSign className="h-4 w-4"/>}
                  </span>
                  <p className="text-xs font-semibold text-white">{String(name)}</p>
                </div>
                <span className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">{String(status)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MarketingContainer></MarketingSection>

    {/* Bonnie Coordination Section — copy preserved, decorative sparkle/gradient removed */}
    <MarketingSection id="bonnie" atmosphere="platform" className="py-10 sm:py-16 lg:py-24"><MarketingContainer><div className="grid gap-8 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
      <div>
        <div className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs font-semibold uppercase tracking-[.22em] text-slate-300">
          <span>Bonnie Coordination</span>
        </div>

        <h2 className="mt-4 font-marketing-heading text-2xl font-extrabold leading-[1.08] text-white sm:text-4xl lg:text-[44px]">
          Tell Bonnie the outcome. It coordinates the work.
        </h2>

        <div className="mt-5 rounded-2xl border border-slate-800 bg-[#020b18] p-5">
          <p className="text-sm font-semibold leading-6 text-slate-200 sm:text-base">
            Bonnie works across the business system rather than simply returning an answer in a chat window.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-300">
            <span className="flex items-center gap-1.5 rounded-md bg-slate-900 px-2.5 py-1 border border-slate-700">
              <Check className="h-3 w-3 text-emerald-400" /> Multi-App Automation
            </span>
            <span className="flex items-center gap-1.5 rounded-md bg-slate-900 px-2.5 py-1 border border-slate-700">
              <Check className="h-3 w-3 text-emerald-400" /> Human Approval Gates
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#020916]">
        <div className="border-b border-slate-800 bg-slate-900/40 p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Active execution</p>
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-300 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/>
              Bonnie Engine Online
            </span>
          </div>
          <blockquote className="mt-2 text-sm font-semibold leading-6 text-white">&ldquo;Find 20 potential customers in Zimbabwe that fit our target profile and prepare outreach.&rdquo;</blockquote>
        </div>
        <div className="divide-y divide-slate-800/70">
          {executionRows.map((r,i)=>(
            <details key={r[0]} open={i===3} className="group px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center gap-3">
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${r[3]==="done"?"bg-emerald-500/10 text-emerald-300 border border-emerald-500/20":r[3]==="active"?"bg-cyan-500/10 text-cyan-300 border border-cyan-500/20":"bg-slate-800 text-slate-400 border border-slate-700"}`}>
                  {r[3]==="done"?<Check className="h-3.5 w-3.5"/>:<span className="h-1.5 w-1.5 rounded-md bg-current"/>}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white">{r[0]}</p>
                  <p className="truncate text-[10px] text-slate-400">{r[1]}</p>
                </div>
                <span className="hidden text-[10px] text-slate-500 sm:block">{r[4]}</span>
                <Status tone={r[3]}>{r[2]}</Status>
                <ChevronRight className="h-3.5 w-3.5 text-slate-500 transition group-open:rotate-90"/>
              </summary>
              {r[3]==="active"&&<div className="ml-9 mt-3"><div className="h-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full w-[70%] rounded-full bg-emerald-400"/></div><p className="mt-2 text-[10px] text-slate-400">Reviewing previous messages before preparing the remaining drafts.</p></div>}
            </details>
          ))}
        </div>
      </div>
    </div></MarketingContainer></MarketingSection>

    {/* What Changes Section */}
    <MarketingSection atmosphere="outcomes" className="py-10 sm:py-16 lg:py-24"><MarketingContainer>
      <Intro eyebrow="What changes" title="What changes when the work is connected" />
      <div className="mt-8 grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <article className="rounded-2xl border border-slate-800 bg-slate-900/35 p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Customer context stays attached</p>
              <h3 className="mt-1 text-lg font-semibold text-white">Acme Corp</h3>
            </div>
            <span className="rounded-md bg-slate-800/80 px-2 py-1 text-[10px] text-slate-300 border border-slate-700">Active customer</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3">
            {[["Last email","2 hours ago"],["Open opportunity","$4,500"],["Meeting","Friday 14:00"],["Proposal","Sent"],["Follow-up","Tomorrow"],["Invoice","Not yet created"]].map(([k,v])=>(
              <div key={k} className="border-l border-slate-700 pl-3">
                <p className="text-[10px] text-slate-500">{k}</p>
                <p className="mt-1 text-xs font-semibold text-white">{v}</p>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-2xl border border-slate-800 bg-[#030b19] p-5">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Follow-up doesn&apos;t depend on memory</p>
          <div className="mt-4 space-y-2 text-xs">
            <div className="rounded-lg bg-slate-900 px-3 py-2 text-slate-300 border border-slate-800">Proposal sent Monday</div>
            <div className="rounded-lg bg-slate-900 px-3 py-2 text-slate-300 border border-slate-800">No response after 3 days</div>
            <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-semibold text-slate-100">Follow-up task automatically prepared</div>
          </div>
        </article>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5">
          <p className="text-sm font-semibold text-white">Admin follows the work</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
            {["Meeting completed","CRM updated","Next task created","Project note attached"].map((x,i)=>(
              <span key={x} className="inline-flex items-center gap-2">
                <span className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1">{x}</span>
              </span>
            ))}
          </div>
        </article>
        <article className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5">
          <p className="text-sm font-semibold text-white">One operational view</p>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {["Sales","Communication","Delivery","Money"].map((x,i)=>(
              <div key={x} className="text-center text-[10px] text-slate-300">
                <span className="mx-auto mb-2 block h-2 w-2 rounded-full bg-cyan-400/80"/>
                {x}
              </div>
            ))}
          </div>
        </article>
      </div>
    </MarketingContainer></MarketingSection>

    {/* Platform Lifecycle Section (Interactive 5-Step Pipeline) */}
    <MarketingSection id="platform" atmosphere="platform" className="py-10 sm:py-16 lg:py-24 border-t border-white/10">
      <LifecycleFlowShowcase />
    </MarketingSection>

    {/* Deals Dashboard Screenshot */}
    <MarketingSection atmosphere="outcomes" className="py-10 sm:py-16 lg:py-24"><MarketingContainer>
      <Intro title="See the business, not another collection of apps." center/>
      <div className="relative group mx-auto mt-9 max-w-6xl">
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#030a16] p-2 sm:p-4 shadow-2xl shadow-slate-950/40 select-none">
          <div className="mb-2.5 flex items-center justify-between border-b border-slate-800 px-3 pb-2 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70"/>
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70"/>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70"/>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900/80 px-3 py-0.5 text-[10px] font-medium text-slate-400">
              <LockKeyhole className="h-2.5 w-2.5 text-slate-400"/>
              <span>alphaclone.app/dashboard/deals</span>
            </div>
            <div className="w-10"/>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 select-none">
            <Image src="/screenshots/deals-dashboard.png" alt="AlphaClone deals dashboard showing connected customer and pipeline information" width={1600} height={950} draggable={false} sizes="(max-width: 768px) 100vw, 1100px" className="h-auto w-full max-w-full pointer-events-none select-none" />
          </div>
          <div className="mt-3.5 grid gap-2 sm:grid-cols-3">
            {[["CRM KNOWS THE CUSTOMER","Sarah Johnson · $2,800 opportunity · Call tomorrow"],["BONNIE KNOWS THE NEXT ACTIONS","Follow up · Prepare contract · Schedule kickoff"],["MONEY CLOSES THE LOOP","Proposal → Contract → Invoice → Payment"]].map(([h,p])=>(
              <div key={h} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                <p className="text-[10px] font-semibold text-slate-400">{h}</p>
                <p className="mt-1 text-xs text-white">{p}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MarketingContainer></MarketingSection>

    {/* Work from your AI Section (Interactive Model & Module Orchestrator) */}
    <MarketingSection atmosphere="platform" className="py-10 sm:py-16 lg:py-24 border-t border-white/10">
      <AiInterfaceShowcase />
    </MarketingSection>

    {/* Business Integrations Section */}
    <MarketingSection atmosphere="outcomes" className="py-10 sm:py-16 lg:py-24"><MarketingContainer>
      <Intro title="Business integrations, grouped by the work they do." body="Recognizable tools stay visible. AlphaClone connects their context and execution instead of hiding everything behind generic platform labels."/>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {integrationGroups.map(g=>(
          <section key={g.title} className="rounded-2xl border border-slate-800 bg-[#020815] p-5">
            <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[.2em] text-slate-400">{g.title}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
              {g.items.map(item=>(
                <article key={item.name} className="flex flex-col justify-between rounded-lg border border-slate-800 bg-[#030c1b] p-3.5">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <item.icon className="h-5 w-5 shrink-0" style={{color:item.color}}/>
                    </div>
                    <p className="mt-3 truncate text-xs font-semibold text-white">{item.name}</p>
                    <p className="mt-1 text-[10px] leading-4 text-slate-400">{item.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </MarketingContainer></MarketingSection>

    {/* Security & Trust Section */}
    <MarketingSection atmosphere="trust" className="py-10 sm:py-16 lg:py-24"><MarketingContainer>
      <Intro title="Your business stays yours." body="See exactly what each connection can do, keep sensitive actions behind approval, and disconnect whenever you choose." center/>
      <div className="mx-auto mt-9 grid max-w-4xl gap-4 md:grid-cols-2">
        {[{name:"Outlook 365",icon:FaMicrosoft,color:"#0078d4",permissions:[["Read email",true],["Send email",true],["Delete email",false]]},{name:"LinkedIn",icon:FaLinkedin,color:"#0a66c2",permissions:[["Read profile",true],["Publish",true],["Send actions require approval",true]]}].map(app=>(
          <article key={app.name} className="overflow-hidden rounded-2xl border border-slate-800 bg-[#030b19]">
            <div className="flex items-center gap-3 border-b border-slate-800 p-4">
              <app.icon className="h-5 w-5" style={{color:app.color}}/>
              <div>
                <h3 className="text-sm font-semibold text-white">{app.name}</h3>
                <p className="text-[10px] text-emerald-300">Connected</p>
              </div>
              <button type="button" className="ml-auto rounded-md border border-slate-800 px-3 py-1.5 text-[10px] font-semibold text-slate-300 hover:border-rose-500/40 hover:bg-rose-500/5 hover:text-rose-200 transition-colors">Disconnect</button>
            </div>
            <div className="divide-y divide-slate-800/80">
              {app.permissions.map(([p,yes])=>(
                <div key={String(p)} className="flex items-center justify-between px-4 py-3 text-xs text-slate-300">
                  <span>{String(p)}</span>
                  {yes?<Check className="h-4 w-4 text-emerald-400"/>:<span className="text-slate-500">—</span>}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
      <div className="mx-auto mt-6 flex max-w-4xl flex-wrap justify-center gap-x-6 gap-y-3 text-[11px] font-medium text-slate-300">
        {[[LockKeyhole,"OAuth connections"],[ShieldCheck,"Granular permissions"],[UserRoundCheck,"Human approval"],[FileCheck2,"Audit history"],[Database,"Data export"]].map(([Icon,x])=>(
          <span key={String(x)} className="inline-flex items-center gap-2">
            <Icon className="h-4 w-4 text-slate-400"/>
            {String(x)}
          </span>
        ))}
      </div>
    </MarketingContainer></MarketingSection>

    {/* About AlphaClone Systems Section */}
    <MarketingSection id="company" atmosphere="outcomes" className="py-8 sm:py-12 lg:py-16"><MarketingContainer>
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-800 bg-slate-900/40 p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-slate-400">About AlphaClone Systems</p>
            <h3 className="mt-1.5 text-lg font-semibold text-white">A connected operating system for service businesses</h3>
            <p className="mt-2 text-xs leading-5 text-slate-300">AlphaClone Systems, LLC is a registered Wyoming software company building one workspace for customer relationships, delivery, communication, documents, invoicing, and AI-assisted execution.</p>
          </div>
          <div className="shrink-0">
            <Link href="/about" className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800/80">
              <span>Learn about our mission</span>
            </Link>
          </div>
        </div>
      </div>
    </MarketingContainer></MarketingSection>

    {/* Final CTA Section */}
    <MarketingSection atmosphere="cta" className="py-10 sm:py-16 lg:py-20"><MarketingContainer>
      <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-slate-800 bg-[#030c1b] px-5 py-10 text-center sm:px-10 sm:py-14">
        <h2 className="font-marketing-heading text-2xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">Stop rebuilding your business context in every app.</h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">CRM, outreach, communication, projects, documents, invoices and AI execution stay connected around the same customer.</p>
        <p className="mt-6 text-lg font-semibold text-slate-200 sm:text-xl">One customer. One context. One operating system.</p>
        <div className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          <PrimaryCTA href={TRIAL_HREF} className="w-full sm:w-auto mkt-btn-large">Start for $15/month</PrimaryCTA>
          <SecondaryCTA href={DEMO_HREF} className="w-full sm:w-auto mkt-btn-large">Book a demo</SecondaryCTA>
        </div>
      </div>
    </MarketingContainer></MarketingSection>
  </MarketingShell>;
}
