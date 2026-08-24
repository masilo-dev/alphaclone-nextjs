"use client";

import React, { useState } from "react";
import {
  Search,
  UserRoundCheck,
  Bot,
  BriefcaseBusiness,
  CircleDollarSign,
  Check,
} from "lucide-react";
import { FaLinkedin, FaMicrosoft } from "react-icons/fa6";
import { SiCalendly, SiStripe, SiZoho } from "react-icons/si";

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
    color: "#06b6d4",
    badge: "20 Leads Found",
    connectors: [
      { name: "Discovery", icon: Search, color: "#06b6d4" },
    ],
    details: ["Prospect research", "ICP qualification", "Email verification"],
  },
  {
    num: "02",
    title: "Win",
    subtitle: "CRM · Outlook · LinkedIn",
    icon: UserRoundCheck,
    color: "#3b82f6",
    badge: "Meeting Booked",
    connectors: [
      { name: "Zoho", icon: SiZoho, color: "#f6c344" },
      { name: "Outlook", icon: FaMicrosoft, color: "#0078d4" },
      { name: "LinkedIn", icon: FaLinkedin, color: "#0a66c2" },
      { name: "Calendly", icon: SiCalendly, color: "#006bfc" },
    ],
    details: ["Context attachment", "2-way calendar sync", "Deal scoring"],
  },
  {
    num: "03",
    title: "Run",
    subtitle: "Bonnie · Tasks · Automation",
    icon: Bot,
    color: "#10b981",
    badge: "AI Executing",
    connectors: [
      { name: "Bonnie", icon: Bot, color: "#10b981" },
    ],
    details: ["Outreach drafting", "Follow-up triggers", "Owner approvals"],
  },
  {
    num: "04",
    title: "Deliver",
    subtitle: "Projects · Documents · Contracts",
    icon: BriefcaseBusiness,
    color: "#a855f7",
    badge: "Phase 100%",
    connectors: [
      { name: "Projects", icon: BriefcaseBusiness, color: "#a855f7" },
    ],
    details: ["Client milestone", "Contract signing", "Deliverable tracking"],
  },
  {
    num: "05",
    title: "Get paid",
    subtitle: "Invoices · Stripe · Revenue",
    icon: CircleDollarSign,
    color: "#f59e0b",
    badge: "$0 Balance",
    connectors: [
      { name: "Stripe", icon: SiStripe, color: "#635bff" },
    ],
    details: ["Auto-invoice trigger", "Stripe payment", "Ledger settlement"],
  },
];

export default function LifecycleFlowShowcase() {
  const [activeStep, setActiveStep] = useState<number>(2);

  return (
    <div className="mx-auto max-w-6xl px-2 sm:px-4">
      {/* Header */}
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/60 px-3.5 py-1 text-xs font-semibold text-slate-300">
          <span>Connected Lifecycle Execution</span>
        </div>
        <h2 className="mt-3 font-marketing-heading text-2xl font-extrabold leading-tight text-white sm:text-4xl lg:text-[42px]">
          From first opportunity to money in the bank.
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">
          Five essential business lifecycle stages, unified around the exact same customer context.
        </p>
      </div>

      {/* Interactive 5-Step Pipeline Grid */}
      <div className="relative mt-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = activeStep === idx;
            return (
              <div
                key={step.num}
                onMouseEnter={() => setActiveStep(idx)}
                className={`group relative flex flex-col justify-between rounded-xl border p-5 transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "border-slate-700 bg-slate-900/60 -translate-y-1"
                    : "border-slate-800 bg-[#020815]/70 hover:border-slate-700 hover:bg-slate-900/50"
                }`}
              >
                <div>
                  {/* Step Number & Badge */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{step.num}</span>
                    <span className={`rounded-md px-2 py-0.5 text-[9px] font-semibold ${
                      isActive ? "bg-slate-800 text-slate-200 border border-slate-700" : "bg-slate-900 text-slate-500 border border-slate-800"
                    }`}>
                      {step.badge}
                    </span>
                  </div>

                  {/* Icon & Title */}
                  <div className="mt-4 flex items-center gap-3">
                    <div
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-800 bg-slate-950"
                    >
                      <Icon className="h-5 w-5" style={{ color: step.color }} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">{step.title}</h3>
                      <p className="text-[10px] text-slate-400 leading-tight">{step.subtitle}</p>
                    </div>
                  </div>

                  {/* Organic Brand Connectors */}
                  <div className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-800 pt-3">
                    {step.connectors.map((c) => {
                      const CIcon = c.icon;
                      return (
                        <span key={c.name} className="flex items-center gap-1 rounded-md border border-slate-800 bg-slate-950/70 px-2 py-1 text-[10px] font-semibold text-slate-300">
                          <CIcon className="h-3 w-3" style={{ color: c.color }} />
                          <span>{c.name}</span>
                        </span>
                      );
                    })}
                  </div>

                  {/* Feature Bullets */}
                  <div className="mt-3 space-y-1">
                    {step.details.map((d) => (
                      <div key={d} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                        <span>{d}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Step Indicator */}
                <div className="mt-4 pt-3 border-t border-slate-800 text-center">
                  <span className={`text-[10px] font-semibold uppercase ${isActive ? "text-slate-200" : "text-slate-500"}`}>
                    {isActive ? "Active Workflow Stage" : "Stage " + step.num}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Summary Banner */}
      <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-center">
        <p className="font-marketing-heading text-sm font-semibold sm:text-base text-slate-200">
          Same customer. Same context. One continuous workflow.
        </p>
      </div>
    </div>
  );
}
