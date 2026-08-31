"use client";

import React, { useState } from "react";
import Image from "next/image";
import { 
  Bot, 
  Database, 
  Share2, 
  CircleDollarSign, 
  LockKeyhole, 
  ChevronDown, 
  Sparkles, 
  CheckCircle2, 
  Zap, 
  Activity, 
  ArrowUpRight,
  ShieldCheck,
  Cpu
} from "lucide-react";

interface FeatureTab {
  id: string;
  label: string;
  badge: string;
  icon: React.ElementType;
  heading: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  urlPath: string;
  metrics: Array<{ label: string; value: string; change: string; positive: boolean }>;
  disclosures: Array<{
    title: string;
    detail: string;
    status: "active" | "completed" | "syncing";
    tag: string;
  }>;
}

const TABS: FeatureTab[] = [
  {
    id: "bonnie",
    label: "01. Bonnie AI Engine",
    badge: "Autonomous Execution",
    icon: Bot,
    heading: "Tell Bonnie the outcome. Watch execution happen in real time.",
    description: "Bonnie doesn't just talk — it searches leads, logs CRM records, drafts email outreach, and triggers approvals across your business stack.",
    imageSrc: "/images/alphaclone-all-in-one-mcp-platform.png",
    imageAlt: "AlphaClone Bonnie AI execution platform view",
    urlPath: "alphaclone.app/bonnie/execution-live",
    metrics: [
      { label: "Execution Speed", value: "0.4s", change: "Instant", positive: true },
      { label: "Tasks Automated", value: "1,420/mo", change: "+34% this week", positive: true },
      { label: "Context Retention", value: "100%", change: "Zero loss", positive: true },
    ],
    disclosures: [
      {
        title: "Autonomous Prospecting & Qualification",
        detail: "Scraps lead directory data, verifies email deliverables, and enriches company metadata automatically.",
        status: "completed",
        tag: "20 leads processed",
      },
      {
        title: "Multi-Channel Outreach Preparation",
        detail: "Generates tailored email drafts in Outlook/Gmail and queues targeted connection requests.",
        status: "active",
        tag: "In progress",
      },
      {
        title: "Human-in-the-Loop Approval Gate",
        detail: "High-risk actions (sending contracts, publishing social posts) require one-click owner approval.",
        status: "syncing",
        tag: "1 approval queued",
      },
    ],
  },
  {
    id: "crm",
    label: "02. Connected CRM",
    badge: "Single Context",
    icon: Database,
    heading: "Complete customer history without opening eleven tabs.",
    description: "Every interaction, meeting, document, proposal, and payment stays linked to the customer account in one unified view.",
    imageSrc: "/screenshots/lead-detail.png",
    imageAlt: "AlphaClone connected lead detail and CRM timeline view",
    urlPath: "alphaclone.app/crm/leads/lead-detail",
    metrics: [
      { label: "Lead Win Rate", value: "48.2%", change: "+12.4% vs old stack", positive: true },
      { label: "Tab Switching", value: "0 tabs", change: "-100% friction", positive: true },
      { label: "Data Accuracy", value: "99.8%", change: "Real-time sync", positive: true },
    ],
    disclosures: [
      {
        title: "Bi-Directional Outlook & Zoho Sync",
        detail: "Emails, calendar bookings, and notes sync effortlessly across connected business accounts.",
        status: "completed",
        tag: "100% synced",
      },
      {
        title: "Deal Pipeline & Smart Score",
        detail: "Automatic lead scoring based on engagement, company size, budget signal, and activity recency.",
        status: "completed",
        tag: "Live updates",
      },
      {
        title: "Activity & Communication Timeline",
        detail: "Never lose track of who said what. Complete audit trail from first touch to signed deal.",
        status: "active",
        tag: "Active tracking",
      },
    ],
  },
  {
    id: "publishing",
    label: "03. Social & Content",
    badge: "Meta v21.0 Certified",
    icon: Share2,
    heading: "Publish, schedule, and analyze across all business channels.",
    description: "Post to Facebook Pages, Instagram Business, and LinkedIn with native v21.0 API stability and real-time performance analytics.",
    imageSrc: "/screenshots/facebook-integration.png",
    imageAlt: "AlphaClone Facebook and social publishing hub dashboard",
    urlPath: "alphaclone.app/social/publishing-hub",
    metrics: [
      { label: "API Version", value: "Meta v21.0", change: "Latest stable", positive: true },
      { label: "Engagement Rate", value: "+28.6%", change: "Across pages", positive: true },
      { label: "Posts Scheduled", value: "42 queued", change: "Auto-distribute", positive: true },
    ],
    disclosures: [
      {
        title: "Facebook & Instagram Direct Publishing",
        detail: "Schedule multi-photo posts, reels, and stories with automated link shortener tracking.",
        status: "completed",
        tag: "Connected",
      },
      {
        title: "LinkedIn Corporate Page Updates",
        detail: "Publish professional announcements and track organic reach with 2026 header standards.",
        status: "completed",
        tag: "Live sync",
      },
      {
        title: "Webhook Lead Capture",
        detail: "Instant CRM lead record creation whenever a prospect submits a Meta Lead Form.",
        status: "active",
        tag: "Realtime trigger",
      },
    ],
  },
  {
    id: "finance",
    label: "04. Money & Billing",
    badge: "Loop Closed",
    icon: CircleDollarSign,
    heading: "From contract sign-off to money settled in the bank.",
    description: "Auto-generate invoices when project milestones complete, collect Stripe payments, and sync ledger entries straight to QuickBooks.",
    imageSrc: "/screenshots/deals-dashboard.png",
    imageAlt: "AlphaClone financial deals and invoice revenue dashboard",
    urlPath: "alphaclone.app/finance/deals-revenue",
    metrics: [
      { label: "Avg Collection", value: "1.8 days", change: "-4.2 days faster", positive: true },
      { label: "Stripe Sync", value: "Instant", change: "Zero manual entry", positive: true },
      { label: "Monthly Revenue", value: "$48,500", change: "+18% MoM", positive: true },
    ],
    disclosures: [
      {
        title: "Automated Milestone Invoicing",
        detail: "Invoices trigger automatically upon project phase completion with zero manual copy-pasting.",
        status: "completed",
        tag: "Automated",
      },
      {
        title: "Stripe Payment Gateway Sync",
        detail: "Accept credit card, ACH, and regional payment methods with automatic receipt delivery.",
        status: "completed",
        tag: "Stripe Verified",
      },
      {
        title: "Automated Overdue Payment Chasing",
        detail: "Polite, scheduled follow-up reminders sent until invoice balance reaches $0.00.",
        status: "active",
        tag: "Bounded policy",
      },
    ],
  },
];

export default function LookInsideAlphaClone() {
  const [activeTabId, setActiveTabId] = useState<string>("bonnie");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const activeTab = TABS.find((t) => t.id === activeTabId) || TABS[0];

  return (
    <div className="mx-auto max-w-6xl px-2 sm:px-4">
      {/* Section Header */}
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-1 text-xs font-bold text-emerald-300 shadow-sm shadow-emerald-950/40 backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
          <span>Interactive Feature Tour</span>
        </div>
        <h2 className="mt-3 font-marketing-heading text-2xl font-extrabold leading-tight text-white sm:text-4xl lg:text-[42px]">
          Look inside <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 bg-clip-text text-transparent">AlphaClone</span>
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">
          Explore how Bonnie coordinates tasks, manages customer records, publishes content, and secures payments in one unified AI operating system.
        </p>
      </div>

      {/* Interactive Tabs */}
      <div className="mt-8 flex flex-wrap justify-center gap-2 border-b border-white/10 pb-4">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTabId(tab.id);
                setExpandedIndex(0);
              }}
              type="button"
              className={`group flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all duration-200 ${
                isActive
                  ? "border border-emerald-400/40 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 text-white shadow-lg shadow-emerald-950/30"
                  : "border border-white/10 bg-slate-900/60 text-slate-400 hover:border-white/20 hover:bg-slate-900/90 hover:text-slate-200"
              }`}
            >
              <Icon className={`h-4 w-4 transition-transform duration-200 ${isActive ? "text-emerald-300 scale-110" : "text-slate-400 group-hover:scale-110"}`} />
              <span>{tab.label}</span>
              <span className={`ml-1 rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wider font-extrabold ${
                isActive ? "bg-emerald-400/20 text-emerald-300 border border-emerald-400/40" : "bg-slate-800 text-slate-500"
              }`}>
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Feature Content Grid */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-start">
        {/* Left Side: Window-Framed Picture (No abrupt boundary cutouts!) */}
        <div className="relative group">
          {/* Glass Glow Backdrop */}
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 blur-xl opacity-70 group-hover:opacity-100 transition duration-500" />
          
          <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#030a16]/95 p-2 sm:p-3 shadow-2xl shadow-cyan-950/50 backdrop-blur-xl transition-all duration-300 group-hover:border-emerald-400/40">
            {/* Browser Bar */}
            <div className="mb-2 flex items-center justify-between border-b border-white/10 px-3 pb-2 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/80 px-3 py-0.5 text-[10px] font-medium text-slate-300">
                <LockKeyhole className="h-2.5 w-2.5 text-emerald-400" />
                <span>{activeTab.urlPath}</span>
              </div>
              <div className="flex items-center gap-1">
                <Activity className="h-3 w-3 text-emerald-400 animate-pulse" />
                <span className="text-[9px] font-bold text-emerald-300 uppercase">Live</span>
              </div>
            </div>

            {/* Seamless Image Container */}
            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-slate-950 select-none">
              <Image
                src={activeTab.imageSrc}
                alt={activeTab.imageAlt}
                width={1200}
                height={800}
                priority
                draggable={false}
                sizes="(max-width: 768px) 100vw, 650px"
                className="h-auto w-full max-w-full object-cover transition-transform duration-500 group-hover:scale-[1.01] pointer-events-none select-none"
              />
              
              {/* Bottom Subtle Overlay Gradient */}
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#020815] to-transparent pointer-events-none" />
            </div>

            {/* Metrics Ribbon underneath image */}
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
              {activeTab.metrics.map((m) => (
                <div key={m.label} className="rounded-xl border border-white/[.08] bg-slate-900/70 p-2 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{m.label}</p>
                  <p className="mt-0.5 text-xs font-black text-white sm:text-sm">{m.value}</p>
                  <p className="text-[9px] font-bold text-emerald-400">{m.change}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Disclosures & Details */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-[#030c1b]/90 p-5 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-extrabold text-white">{activeTab.heading}</h3>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-300 sm:text-sm">{activeTab.description}</p>
          </div>

          {/* Expandable Disclosure Accordion */}
          <div className="space-y-2.5">
            <p className="text-[11px] font-black uppercase tracking-[.2em] text-emerald-300 px-1">
              Capabilities & Live Workflows
            </p>
            {activeTab.disclosures.map((item, idx) => {
              const isExpanded = expandedIndex === idx;
              return (
                <div
                  key={item.title}
                  className={`overflow-hidden rounded-xl border transition-all duration-200 ${
                    isExpanded
                      ? "border-emerald-400/40 bg-slate-900/90 shadow-md shadow-emerald-950/20"
                      : "border-white/10 bg-slate-950/60 hover:border-white/20 hover:bg-slate-900/60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                    className="flex w-full items-center justify-between p-3.5 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
                          item.status === "completed"
                            ? "bg-emerald-400/10 text-emerald-300 border border-emerald-400/30"
                            : item.status === "active"
                            ? "bg-cyan-400/10 text-cyan-300 border border-cyan-400/30"
                            : "bg-amber-400/10 text-amber-300 border border-amber-400/30"
                        }`}
                      >
                        {item.status === "completed" ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <Zap className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-white group-hover:text-emerald-200">
                          {item.title}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                        {item.tag}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                          isExpanded ? "rotate-180 text-emerald-400" : ""
                        }`}
                      />
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-white/[.06] bg-slate-900/40 p-3.5 text-xs leading-5 text-slate-300">
                      <p>{item.detail}</p>
                      <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-emerald-400">
                        <ShieldCheck className="h-3 w-3" />
                        <span>Execution verified by Bonnie Engine</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
