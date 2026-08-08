"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlphaIcon } from "@/components/marketing/icons";
import type { AlphaIconName } from "@/components/marketing/icons";

interface WorkflowStep {
  id: string;
  step: string;
  title: string;
  desc: string;
  icon: AlphaIconName;
  color: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: "lead",
    step: "01",
    title: "New Lead Ingestion",
    desc: "Capture leads automatically from web forms, social ads, or email outreach into CRM.",
    icon: "leads",
    color: "from-blue-500 to-cyan-400",
  },
  {
    id: "proposal",
    step: "02",
    title: "AI Proposal Generation",
    desc: "Generate customized proposals with smart pricing and terms in seconds using Bonnie AI.",
    icon: "documents",
    color: "from-teal-500 to-emerald-400",
  },
  {
    id: "contract",
    step: "03",
    title: "E-Sign Contract",
    desc: "Auto-send legal contracts for e-signature with instant audit logging and document storage.",
    icon: "check",
    color: "from-amber-500 to-yellow-400",
  },
  {
    id: "invoice",
    step: "04",
    title: "Instant Invoice & Tax",
    desc: "Convert won deals directly into compliant invoices sent via preferred email providers.",
    icon: "invoicing",
    color: "from-purple-500 to-indigo-400",
  },
  {
    id: "payment",
    step: "05",
    title: "Reconciled Payment",
    desc: "Receive payments, update P&L snapshot, and notify team automatically.",
    icon: "reports",
    color: "from-emerald-500 to-teal-400",
  },
];

const CUSTOMER_SCENARIOS = [
  {
    id: "agency",
    role: "Digital Agency & Freelancers",
    challenge:
      "Tired of paying $400/mo for HubSpot, DocuSign, Harvest & Buffer separately.",
    solution:
      "AlphaClone replaces 5 fragmented tools for $15/mo with an AI assistant that handles admin work.",
    metric: "Save $4,600+/yr",
  },
  {
    id: "consultant",
    role: "B2B Consultants & Services",
    challenge:
      "Losing 10+ hours a week copying lead data, drafting proposals, and chasing overdue invoices.",
    solution:
      "Execute complete Lead → Contract → Payment workflows in under 60 seconds.",
    metric: "10+ hrs saved weekly",
  },
  {
    id: "solopreneur",
    role: "Solo Founders & Small Teams",
    challenge:
      "Need enterprise-grade operating capabilities without hiring expensive operations staff.",
    solution:
      "Connect your favorite AI (ChatGPT/Claude/Manus) via MCP to operate your business in plain English.",
    metric: "100% Autopilot ready",
  },
];

export default function AllInOnePlatformShowcase() {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [activeScenario, setActiveScenario] = useState<string>("agency");

  return (
    <div className="w-full my-12 text-slate-100 select-none">
      {/* Header Banner */}
      <div className="text-center max-w-4xl mx-auto px-4 mb-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs sm:text-sm font-medium mb-4">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
          </span>
          All-In-One Intelligent Business OS
        </div>
        <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-3 font-marketing-heading">
          Everything Your Business Needs.{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400">
            All in One Intelligent Platform.
          </span>
        </h2>
        <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto">
          CRM, Projects, Finance, Marketing, Documents & more — connect via MCP
          and automate your entire operational workflow.
        </p>
      </div>

      {/* Main Image Showcase Card with Protected Display */}
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <div className="relative rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-900/80 shadow-2xl shadow-teal-950/40 backdrop-blur-md">
          {/* Top Bar Decoration */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-950/70 border-b border-slate-800 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
              <span className="ml-2 font-mono text-[11px] text-slate-400 hidden sm:inline">
                alphaclone-workspace.app
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium text-xs">
                489 Platform Tools Active
              </span>
            </div>
          </div>

          {/* Protected Static Image Display Area */}
          <div
            className="relative mx-auto w-full max-w-[92vw] sm:max-w-3xl lg:max-w-5xl aspect-[16/10] bg-slate-950 flex items-center justify-center overflow-hidden"
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
          >
            <Image
              src="/images/alphaclone-all-in-one-mcp-platform.png"
              alt="AlphaClone All In One Intelligent Platform Architecture"
              fill
              priority
              sizes="(max-width: 640px) 92vw, (max-width: 1024px) 768px, 1024px"
              className="object-contain pointer-events-none select-none"
              draggable={false}
            />
            {/* Transparent overlay preventing right-click, saving, downloading, and click actions */}
            <div
              className="absolute inset-0 z-20 bg-transparent"
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
            />
          </div>

          {/* Feature Strip Footer */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 sm:p-6 bg-slate-950/90 border-t border-slate-800 text-center">
            <div className="p-2 sm:p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <p className="text-xs text-slate-400 font-medium">
                Connect Favorite Tools
              </p>
              <p className="text-sm font-semibold text-teal-300 mt-1">
                ChatGPT, Claude, Manus & Gmail
              </p>
            </div>
            <div className="p-2 sm:p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <p className="text-xs text-slate-400 font-medium">
                Model Context Protocol
              </p>
              <p className="text-sm font-semibold text-emerald-300 mt-1">
                Secure Real-Time Action
              </p>
            </div>
            <div className="p-2 sm:p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <p className="text-xs text-slate-400 font-medium">
                Publish Everywhere
              </p>
              <p className="text-sm font-semibold text-cyan-300 mt-1">
                Meta, LinkedIn, Zoho & Brevo
              </p>
            </div>
            <div className="p-2 sm:p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <p className="text-xs text-slate-400 font-medium">
                Platform Power
              </p>
              <p className="text-sm font-semibold text-amber-300 mt-1">
                489 Tools Exposable via MCP
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 1-Minute Complete Workflow Demonstration */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-16">
        <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
                Complete End-To-End Business Flow
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-white mt-1">
                From Lead to Cash in Under 60 Seconds
              </h3>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Zero Context Switching Required</span>
            </div>
          </div>

          {/* Stepper Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {WORKFLOW_STEPS.map((s, idx) => {
              const isSelected = activeStep === idx;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveStep(idx)}
                  className={`text-left p-4 rounded-xl border transition-all relative overflow-hidden ${
                    isSelected
                      ? "bg-slate-800/90 border-teal-500/80 shadow-lg shadow-teal-950/50"
                      : "bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-950 border ${isSelected ? "border-teal-500/50 text-teal-300" : "border-slate-800 text-slate-400"}`}
                    >
                      {s.step}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full bg-gradient-to-r ${s.color}`}
                    ></span>
                  </div>
                  <h4 className="font-bold text-white text-sm mb-1">
                    {s.title}
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {s.desc}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Selected Step Deep Dive Banner */}
          <div className="mt-6 p-4 sm:p-5 rounded-xl bg-slate-950 border border-teal-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 shrink-0">
                <AlphaIcon name={WORKFLOW_STEPS[activeStep].icon} size="md" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-teal-400 uppercase font-mono">
                    Step {WORKFLOW_STEPS[activeStep].step} Spotlight
                  </span>
                  <span className="text-xs text-slate-400">
                    • Automated Action
                  </span>
                </div>
                <h5 className="text-base font-bold text-white mt-0.5">
                  {WORKFLOW_STEPS[activeStep].title}
                </h5>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  {WORKFLOW_STEPS[activeStep].desc}
                </p>
              </div>
            </div>
            <Link
              href="/auth/login?register=true&plan=starter"
              className="shrink-0 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-600 text-white font-semibold text-xs sm:text-sm transition-colors shadow-md shadow-teal-900/40"
            >
              Test This Workflow Free →
            </Link>
          </div>
        </div>
      </div>

      {/* Real Customer Scenarios Grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h3 className="text-xl sm:text-3xl font-bold text-white font-marketing-heading">
            Built For How Real Businesses Actually Work
          </h3>
          <p className="text-sm text-slate-400 mt-2">
            No bloated corporate jargon. Just practical automation tailored for
            small teams and solo operators.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CUSTOMER_SCENARIOS.map((sc) => (
            <div
              key={sc.id}
              onClick={() => setActiveScenario(sc.id)}
              className={`p-6 rounded-2xl border transition-all cursor-pointer ${
                activeScenario === sc.id
                  ? "bg-slate-900 border-teal-500/80 shadow-xl shadow-teal-950/30 ring-1 ring-teal-500/30"
                  : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-500/10 text-teal-300 border border-teal-500/30">
                  {sc.role}
                </span>
                <span className="text-xs font-mono font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded">
                  {sc.metric}
                </span>
              </div>
              <div className="mb-3">
                <p className="flex items-center gap-1 text-[10px] text-rose-400 font-semibold mb-1 uppercase tracking-wider">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M2 2l6 6M8 2l-6 6"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                  Old Way:
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {sc.challenge}
                </p>
              </div>
              <div>
                <p className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold mb-1 uppercase tracking-wider">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M1.5 5l2.5 2.5L8.5 2"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  AlphaClone Way:
                </p>
                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                  {sc.solution}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
