"use client";

import React, { useState } from "react";
import { 
  Search, 
  UserRoundCheck, 
  Workflow,
  BriefcaseBusiness, 
  CircleDollarSign, 
  ArrowRight, 
  Check, 
  ClipboardCheck,
  TrendingUp
} from "lucide-react";
import { FaLinkedin, FaMicrosoft } from "react-icons/fa6";
import { SiCaldotcom, SiStripe, SiZoho } from "react-icons/si";

interface LifecycleStep {
  num: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  badge: string;
  connectors: Array<{ name: string; icon: React.ElementType; color: string }>;
  details: string[];
}

const STEPS: LifecycleStep[] = [
  {
    num: "01",
    title: "Find",
    subtitle: "Lead discovery · Qualification",
    icon: Search,
    color: "var(--info-500)",
    badge: "20 Leads Found",
    connectors: [
      { name: "Discovery", icon: Search, color: "var(--info-500)" },
    ],
    details: ["Prospect research", "ICP qualification", "Email verification"],
  },
  {
    num: "02",
    title: "Win",
    subtitle: "CRM · Outlook · LinkedIn",
    icon: UserRoundCheck,
    color: "var(--info-500)",
    badge: "Meeting Booked",
    connectors: [
      { name: "Zoho", icon: SiZoho, color: "var(--warning-500)" },
      { name: "Outlook", icon: FaMicrosoft, color: "var(--logo-microsoft)" },
      { name: "LinkedIn", icon: FaLinkedin, color: "var(--logo-linkedin)" },
      { name: "Cal.com", icon: SiCaldotcom, color: "var(--ws-panel)" },
    ],
    details: ["Context attachment", "2-way calendar sync", "Deal scoring"],
  },
  {
    num: "03",
    title: "Run",
    subtitle: "Bonnie · Tasks · Automation",
    icon: Workflow,
    color: "var(--success-500)",
    badge: "AI Executing",
    connectors: [
      { name: "Bonnie", icon: ClipboardCheck, color: "var(--success-500)" },
    ],
    details: ["Outreach drafting", "Follow-up triggers", "Owner approvals"],
  },
  {
    num: "04",
    title: "Deliver",
    subtitle: "Projects · Documents · Contracts",
    icon: BriefcaseBusiness,
    color: "var(--brand-violet-400)",
    badge: "Phase 100%",
    connectors: [
      { name: "Projects", icon: BriefcaseBusiness, color: "var(--brand-violet-400)" },
    ],
    details: ["Client milestone", "Contract signing", "Deliverable tracking"],
  },
  {
    num: "05",
    title: "Get paid",
    subtitle: "Invoices · Stripe · Revenue",
    icon: CircleDollarSign,
    color: "var(--warning-500)",
    badge: "$0 Balance",
    connectors: [
      { name: "Stripe", icon: SiStripe, color: "var(--logo-stripe)" },
    ],
    details: ["Auto-invoice trigger", "Stripe payment", "Ledger settlement"],
  },
];

export default function LifecycleFlowShowcase() {
  const [activeStep, setActiveStep] = useState<number>(2); // Default on Bonnie "Run"

  return (
    <div className="mx-auto max-w-6xl px-2 sm:px-4">
      {/* Header */}
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-[var(--success-500)]/10 px-3.5 py-1 type-caption font-bold text-[var(--success-text,var(--success-500))] shadow-sm backdrop-blur-md">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
          <span>Connected Lifecycle Execution</span>
        </div>
        <h2 className="mt-3 font-marketing-heading text-2xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">
          From first opportunity to <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-green-300 bg-clip-text text-transparent">money in the bank.</span>
        </h2>
        <p className="mt-3 type-card-description leading-6 text-[var(--ws-text-secondary)] sm:text-base">
          Five essential business lifecycle stages, unified around the exact same customer context.
        </p>
      </div>

      {/* Interactive 5-Step Pipeline Grid */}
      <div className="relative mt-10">
        {/* Glowing Data Pipeline Background Line */}
        <div className="hidden lg:block absolute left-8 right-8 top-12 h-1 bg-gradient-to-r from-cyan-500 via-emerald-400 to-amber-500 rounded-full opacity-30 pointer-events-none" />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = activeStep === idx;
            return (
              <div
                key={step.num}
                onMouseEnter={() => setActiveStep(idx)}
                className={`group relative flex flex-col justify-between rounded-2xl border p-5 transition-all duration-300 cursor-pointer ${
                  isActive
                    ? "border-emerald-400/50 bg-gradient-to-b from-[var(--brand-violet-950)] via-slate-900/90 to-[var(--brand-violet-950)] shadow-xl shadow-emerald-950/40 -translate-y-2"
                    : "border-white/10 bg-[var(--brand-violet-950)]/80 hover:border-white/20 hover:bg-[var(--ws-panel)]/60 hover:-translate-y-1"
                }`}
              >
                <div>
                  {/* Step Number & Badge */}
                  <div className="flex items-center justify-between">
                    <span className="type-caption font-black uppercase tracking-wider text-cyan-400">{step.num}</span>
                    <span className={`rounded-full px-2 py-0.5 type-ui font-extrabold ${
                      isActive ? "bg-[var(--success-500)]/20 text-[var(--success-text,var(--success-500))] border border-emerald-400/40" : "bg-[var(--ws-surface-secondary)] text-[var(--ws-text-muted)]"
                    }`}>
                      {step.badge}
                    </span>
                  </div>

                  {/* Icon & Title */}
                  <div className="mt-4 flex items-center gap-3">
                    <div
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-[var(--ws-canvas)] transition-transform duration-300 group-hover:scale-110`}
                      style={{ boxShadow: isActive ? `0 0 20px ${step.color}40` : undefined }}
                    >
                      <Icon className="h-5 w-5" style={{ color: step.color }} />
                    </div>
                    <div>
                      <h3 className="text-base font-black uppercase text-white group-hover:text-cyan-200">{step.title}</h3>
                      <p className="type-card-description text-[var(--ws-text-muted)] leading-tight">{step.subtitle}</p>
                    </div>
                  </div>

                  {/* Organic Brand Connectors */}
                  <div className="mt-4 flex flex-wrap gap-1.5 border-t border-white/[.07] pt-3">
                    {step.connectors.map((c) => {
                      const CIcon = c.icon;
                      return (
                        <span key={c.name} className="flex items-center gap-1 rounded-md border border-white/[.08] bg-[var(--ws-canvas)]/70 px-2 py-1 type-ui font-bold text-[var(--ws-text-secondary)]">
                          <CIcon className="h-3 w-3" style={{ color: c.color }} />
                          <span>{c.name}</span>
                        </span>
                      );
                    })}
                  </div>

                  {/* Feature Bullets */}
                  <div className="mt-3 space-y-1">
                    {step.details.map((d) => (
                      <div key={d} className="flex items-center gap-1.5 type-ui text-[var(--ws-text-muted)]">
                        <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                        <span>{d}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Step Indicator */}
                <div className="mt-4 pt-3 border-t border-white/[.05] text-center">
                  <span className={`type-caption font-extrabold uppercase ${isActive ? "text-[var(--success-text,var(--success-500))]" : "text-[var(--ws-text-muted)]"}`}>
                    {isActive ? "✓ Active Workflow Stage" : "Stage " + step.num}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Summary Banner */}
      <div className="mt-8 rounded-2xl border border-emerald-400/30 bg-gradient-to-r from-emerald-950/40 via-teal-900/30 to-slate-900/60 p-4 text-center backdrop-blur-xl shadow-lg">
        <p className="font-marketing-heading type-card-description font-extrabold sm:text-base text-[var(--success-text,var(--success-500))]">
          Same customer. Same context. One continuous workflow.
        </p>
      </div>
    </div>
  );
}
