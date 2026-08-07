'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  BarChart3,
  Bot,
  Calendar,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  ExternalLink,
  Layers,
  LayoutDashboard,
  Lock,
  Mail,
  Megaphone,
  MessageSquare,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Workflow,
  Zap
} from 'lucide-react';
import { DEMO_HREF, TRIAL_HREF } from '@/lib/marketing/cta';
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

// Step definition for Live Business Movement
const liveMovementSteps = [
  { time: '09:14', title: 'New lead captured', detail: 'Inbound response from LinkedIn campaign', stage: 'Marketing', icon: Target },
  { time: '09:14', title: 'CRM contact created', detail: 'Contact record automatically initialized', stage: 'CRM', icon: Users },
  { time: '09:15', title: 'Bonnie reviews opportunity', detail: 'Lead scored and context synthesized', stage: 'Bonnie AI', icon: Bot },
  { time: '09:16', title: 'Follow-up prepared', detail: 'Personalized outreach ready for dispatch', stage: 'Outreach', icon: Mail },
  { time: '11:30', title: 'Meeting booked', detail: 'Calendar slot confirmed without back-and-forth', stage: 'Calendar', icon: Calendar },
  { time: '14:08', title: 'Proposal accepted', detail: 'Client signed terms digitally', stage: 'Documents', icon: Workflow },
  { time: '14:09', title: 'Invoice generated', detail: 'Billable milestone converted automatically', stage: 'Invoicing', icon: CircleDollarSign },
  { time: '16:22', title: 'Payment received', detail: 'Revenue recorded in Money Hub (+$2,400)', stage: 'Revenue', icon: CheckCircle2 },
];

// Product Explorer Tabs & UI Mockup Data
const productTabs = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'crm', label: 'CRM', icon: Users },
  { id: 'marketing', label: 'Marketing', icon: Megaphone },
  { id: 'money', label: 'Money Hub', icon: CircleDollarSign },
  { id: 'bonnie', label: 'Bonnie AI', icon: Bot },
];

export default function MarketingHomePage() {
  const [activeStep, setActiveStep] = useState(2); // Step 3 active by default
  const [activeTab, setActiveTab] = useState<'dashboard' | 'crm' | 'marketing' | 'money' | 'bonnie'>('dashboard');
  const [bonnieExecuted, setBonnieExecuted] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Auto-cycle live movement demo steps every 3.5s if reduced motion isn't set
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % liveMovementSteps.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const handleExecuteBonnie = () => {
    setIsExecuting(true);
    setTimeout(() => {
      setIsExecuting(false);
      setBonnieExecuted(true);
    }, 900);
  };

  const handleResetBonnie = () => {
    setBonnieExecuted(false);
  };

  return (
    <MarketingShell>
      {/* ── 1. HERO ── */}
      <section className="mkt-hero mkt-hero--compact pt-20 sm:pt-28 pb-12 sm:pb-20">
        <SectionAmbientLight variant="hero" />
        <HeroDataWaves />
        <CurvedDotField />
        <MarketingContainer>
          <div className="mkt-hero-copy mkt-reveal text-center max-w-4xl mx-auto px-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-3.5 py-1 text-xs font-bold text-teal-300 mb-5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>THE BUSINESS EXECUTION SYSTEM</span>
            </div>
            
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-5 font-marketing-heading leading-[1.1]">
              Run your business.<br className="hidden sm:inline" /> Not your software.
            </h1>
            
            <p className="text-sm sm:text-base md:text-lg text-slate-300 max-w-2.5xl mx-auto mb-8 leading-relaxed font-normal">
              Marketing. Sales. Customers. Payments. Operations. One connected system — with AI that can work across your business, not just chat about it.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mb-10 max-w-md mx-auto sm:max-w-none">
              <PrimaryCTA href={DEMO_HREF} className="w-full sm:w-auto mkt-btn-large">
                Watch AlphaClone Run a Business
              </PrimaryCTA>
              <SecondaryCTA href="#movement" className="w-full sm:w-auto mkt-btn-large">
                Explore the System
              </SecondaryCTA>
            </div>
          </div>
        </MarketingContainer>
      </section>

      <SectionConnector variant="fade" />

      {/* ── 2. LIVE BUSINESS MOVEMENT ── */}
      <MarketingSection id="movement" atmosphere="platform" className="py-12 sm:py-16">
        <MarketingContainer>
          <div className="mx-auto mb-8 sm:mb-12 max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-md border border-teal-500/20 bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-300 mb-3">
              <Play className="w-3 h-3 fill-current" />
              <span>AlphaClone interactive demo</span>
            </div>
            <h2 className="font-marketing-heading text-2xl sm:text-4xl font-extrabold text-white">
              Watch one opportunity move through the business.
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-400">
              MARKETING → CUSTOMER → SALES → COMMUNICATION → OPERATIONS → PAYMENT
            </p>
          </div>

          {/* Interactive Movement Card */}
          <div className="mx-auto max-w-5xl rounded-3xl border border-slate-800 bg-slate-950/90 shadow-2xl overflow-hidden backdrop-blur-xl">
            {/* Command Bar Header */}
            <div className="flex flex-wrap items-center justify-between border-b border-slate-800/80 bg-slate-900/60 px-4 py-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="ml-2 font-mono font-semibold text-slate-300 hidden sm:inline">Execution Pipeline // Acquired Lead #4092</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <span className="text-[11px] bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">Example business workflow</span>
              </div>
            </div>

            {/* Grid Content */}
            <div className="grid grid-cols-1 lg:grid-cols-12">
              {/* Timeline Steps (Left column) */}
              <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-slate-800/80 p-4 sm:p-6 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Workflow Progression</p>
                {liveMovementSteps.map((step, idx) => {
                  const Icon = step.icon;
                  const isActive = idx === activeStep;
                  return (
                    <button
                      key={step.time + step.title}
                      onClick={() => setActiveStep(idx)}
                      className={`w-full text-left flex items-start gap-3 p-3 rounded-2xl border transition-all ${
                        isActive
                          ? 'border-teal-500/50 bg-teal-500/10 shadow-lg shadow-teal-950/20'
                          : 'border-slate-800/60 bg-slate-900/40 hover:bg-slate-900/80 text-slate-400'
                      }`}
                    >
                      <div className={`mt-0.5 shrink-0 rounded-xl p-2 ${isActive ? 'bg-teal-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-300'}`}>{step.title}</span>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">{step.time}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">{step.detail}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Active Step Real-time Context (Right column) */}
              <div className="lg:col-span-7 p-5 sm:p-8 flex flex-col justify-between bg-slate-950/50">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-xs font-bold uppercase tracking-widest text-teal-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {liveMovementSteps[activeStep].time} — Stage: {liveMovementSteps[activeStep].stage}
                    </span>
                    <span className="text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                      Status: Active
                    </span>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-300">
                        {React.createElement(liveMovementSteps[activeStep].icon, { className: "w-6 h-6" })}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">{liveMovementSteps[activeStep].title}</h3>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">{liveMovementSteps[activeStep].detail}</p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <span className="text-slate-400 text-[10px] block">Context Continuity</span>
                        <span className="text-white font-semibold mt-0.5 block">Zero manual data re-entry</span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <span className="text-slate-400 text-[10px] block">Connected Module</span>
                        <span className="text-teal-300 font-semibold mt-0.5 block">{liveMovementSteps[activeStep].stage}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Total Pipeline Realized:</span>
                  <span className="text-lg font-bold text-emerald-400 font-mono">Revenue +$2,400</span>
                </div>
              </div>
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* ── 3. THE PROBLEM ── */}
      <MarketingSection atmosphere="outcomes" className="py-12 sm:py-16">
        <MarketingContainer>
          <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5 space-y-4">
              <span className="text-xs font-bold uppercase tracking-widest text-teal-400">The Problem</span>
              <h2 className="font-marketing-heading text-2xl sm:text-4xl font-extrabold text-white leading-tight">
                Your business shouldn't need ten systems to complete one job.
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-slate-300">
                The enemy is fragmentation: work moves forward, but context gets trapped in separate apps, tabs and handoffs.
              </p>

              <div className="flex flex-wrap gap-2 pt-2">
                {['Lost context', 'Manual work', 'Missed follow-ups', 'Too many subscriptions'].map((chip) => (
                  <span key={chip} className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300">
                    ⚠️ {chip}
                  </span>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7 space-y-4">
              {/* Fragmented Stack Diagram */}
              <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">Fragmented Stack</span>
                  <span className="text-[10px] text-slate-400">11 Disconnected Tools</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                  {['Social platform', 'Lead form', 'Spreadsheet', 'CRM', 'Email', 'Calendar', 'Documents', 'Invoicing', 'Payment system', 'Reporting', 'AI assistant'].map((tool, idx) => (
                    <React.Fragment key={tool}>
                      <span className="rounded-lg bg-slate-950 px-2.5 py-1 text-slate-300 border border-slate-800 text-[11px] font-mono">{tool}</span>
                      {idx < 10 && <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Contrast AlphaClone Solution */}
              <div className="rounded-3xl border border-teal-500/30 bg-teal-500/10 p-5 sm:p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-300 uppercase tracking-wider">The AlphaClone Contrast</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Connected Execution</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-white pt-2 font-mono">
                  <span className="bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">ONE OPPORTUNITY</span>
                  <ArrowRight className="w-4 h-4 text-teal-400 shrink-0" />
                  <span className="bg-teal-500 text-slate-950 px-4 py-2 rounded-xl font-extrabold">ALPHACLONE</span>
                  <ArrowRight className="w-4 h-4 text-teal-400 shrink-0" />
                  <span className="bg-emerald-500/20 text-emerald-300 px-3 py-2 rounded-xl border border-emerald-500/30">REVENUE</span>
                </div>
              </div>
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* ── 4. BONNIE — AI EXECUTION ── */}
      <MarketingSection id="ai-engine" atmosphere="platform" className="py-12 sm:py-16">
        <MarketingContainer>
          <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-xl border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-bold text-teal-300">
                <Bot className="w-4 h-4" />
                <span>Bonnie AI Execution</span>
              </div>
              <h2 className="font-marketing-heading text-2xl sm:text-4xl font-extrabold text-white leading-tight">
                AI operating inside your business — not just chatting beside it.
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-slate-300">
                Traditional AI requires you to ask questions, copy answers, and perform manual work elsewhere. Bonnie monitors business events, understands context, and executes across connected systems.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl border border-slate-800 bg-slate-900/50">
                  <p className="text-xs font-bold text-slate-400">Traditional AI</p>
                  <p className="text-xs text-slate-400 mt-1">User asks → AI answers → Manual work elsewhere.</p>
                </div>
                <div className="p-3.5 rounded-2xl border border-teal-500/30 bg-teal-500/10">
                  <p className="text-xs font-bold text-teal-300">AlphaClone Bonnie</p>
                  <p className="text-xs text-slate-300 mt-1">Event occurs → Context understood → Action proposed & executed.</p>
                </div>
              </div>
            </div>

            {/* Bonnie Execution Demo Card */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 sm:p-7 shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">BONNIE FOUND</h4>
                      <p className="text-xs text-amber-400 font-medium">3 proposals have received no reply.</p>
                    </div>
                  </div>
                  {bonnieExecuted && (
                    <button
                      onClick={handleResetBonnie}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" /> Reset Demo
                    </button>
                  )}
                </div>

                {!bonnieExecuted ? (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Recommended Execution Actions:</p>
                    <ul className="space-y-2 text-xs text-slate-300">
                      {[
                        'Draft personalized follow-up emails for lead contacts',
                        'Attach relevant proposals and updated pricing deck',
                        'Update CRM deal stage to "Follow-up Pending"',
                        'Schedule follow-up reminder tasks for tomorrow 09:00'
                      ].map((act, i) => (
                        <li key={i} className="flex items-start gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-teal-400 mt-1.5 shrink-0" />
                          <span>{act}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="pt-3 flex flex-wrap items-center gap-3">
                      <button
                        onClick={handleExecuteBonnie}
                        disabled={isExecuting}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-teal-400 transition-all min-h-[42px]"
                      >
                        {isExecuting ? (
                          <>
                            <Zap className="w-4 h-4 animate-spin" />
                            <span>Executing connected actions...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4" />
                            <span>Execute Actions</span>
                          </>
                        )}
                      </button>
                      <button className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors min-h-[42px]">
                        Review Actions
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 animate-in zoom-in-95 duration-300">
                    <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Actions successfully executed across connected modules!
                    </div>

                    <div className="space-y-2 text-xs">
                      {[
                        '3 follow-ups prepared & dispatched',
                        'CRM lead records updated automatically',
                        'Follow-up tasks scheduled in Calendar',
                        'Activity logged in Customer Timeline'
                      ].map((res, i) => (
                        <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>{res}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* ── 5. REAL PRODUCT EXPLORER ── */}
      <MarketingSection id="product" atmosphere="trust" className="py-12 sm:py-16">
        <MarketingContainer>
          <div className="mx-auto mb-8 max-w-3xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-teal-400">Production UI</span>
            <h2 className="font-marketing-heading text-2xl sm:text-4xl font-extrabold text-white mt-1">
              Explore the real AlphaClone interface.
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-400">
              Built for real business operation. See how components connect across the platform.
            </p>

            {/* Category Selector Tabs */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 p-1.5 rounded-2xl border border-slate-800 bg-slate-950/80 max-w-2xl mx-auto">
              {productTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive UI Mockup Container */}
          <div className="mx-auto max-w-5xl rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-4 py-3 text-xs text-slate-400">
              <span className="font-mono text-slate-300">AlphaClone Systems v2.4 // Module: {activeTab.toUpperCase()}</span>
              <span className="text-[11px] text-teal-400 font-bold">Live Component View</span>
            </div>

            <div className="p-6 sm:p-8 min-h-[320px] flex flex-col justify-center">
              {activeTab === 'dashboard' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Active Pipeline', val: '$124,500' },
                      { label: 'Unpaid Invoices', val: '$8,200' },
                      { label: 'Open Opportunities', val: '28' },
                      { label: 'Bonnie Health', val: '100% Operational' }
                    ].map((m, i) => (
                      <div key={i} className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60">
                        <p className="text-[10px] uppercase text-slate-400 font-bold">{m.label}</p>
                        <p className="text-lg sm:text-xl font-bold text-white mt-1 font-mono">{m.val}</p>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/40 text-xs text-slate-300">
                    <p className="font-bold text-white">Unified Command Center</p>
                    <p className="mt-1 text-slate-400">Provides real-time visibility over sales, active jobs, client messaging, and upcoming financial settlement dates.</p>
                  </div>
                </div>
              )}

              {activeTab === 'crm' && (
                <div className="space-y-3 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300 border-b border-slate-800 pb-2">
                    <span>Contact Name</span>
                    <span>Company</span>
                    <span>Pipeline Stage</span>
                    <span>Last Interaction</span>
                  </div>
                  {[
                    { name: 'Sarah Jenkins', co: 'Apex Global', stage: 'Proposal Sent', time: '10 mins ago' },
                    { name: 'Marcus Vance', co: 'Vance Tech', stage: 'Meeting Scheduled', time: '1 hour ago' },
                    { name: 'Elena Rostova', co: 'Nordic Design', stage: 'Contract Signed', time: '3 hours ago' },
                  ].map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-3 rounded-xl border border-slate-800/80 bg-slate-900/40">
                      <span className="font-bold text-white">{c.name}</span>
                      <span className="text-slate-400">{c.co}</span>
                      <span className="text-teal-300 font-mono">{c.stage}</span>
                      <span className="text-slate-400">{c.time}</span>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'marketing' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-white">LinkedIn Lead Gen Campaign #4</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Capturing direct decision-maker inquiries into CRM</p>
                    </div>
                    <span className="text-xs font-mono font-bold bg-teal-500/10 text-teal-300 border border-teal-500/20 px-3 py-1.5 rounded-xl">
                      34 Leads Generated
                    </span>
                  </div>
                </div>
              )}

              {activeTab === 'money' && (
                <div className="space-y-3 animate-in fade-in duration-300">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
                      <span className="text-xs text-slate-400 font-bold uppercase">Pending Invoices</span>
                      <p className="text-2xl font-bold text-amber-400 mt-1 font-mono">$12,400</p>
                      <p className="text-xs text-slate-400 mt-2">3 invoices ready for auto-reminders</p>
                    </div>
                    <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
                      <span className="text-xs text-slate-400 font-bold uppercase">Settled Revenue (MTD)</span>
                      <p className="text-2xl font-bold text-emerald-400 mt-1 font-mono">$48,950</p>
                      <p className="text-xs text-slate-400 mt-2">Direct payout via connected payments</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'bonnie' && (
                <div className="space-y-3 animate-in fade-in duration-300">
                  <div className="p-4 rounded-2xl border border-teal-500/20 bg-teal-500/10 text-xs text-teal-200">
                    <p className="font-bold">Bonnie AI System Journal</p>
                    <p className="mt-1 text-slate-300">Monitored 142 business events today across CRM, Calendar, and Money Hub without manual prompt requirement.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* ── 6. BUSINESS OUTCOMES ── */}
      <MarketingSection atmosphere="outcomes" className="py-12 sm:py-16">
        <MarketingContainer>
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-teal-400">Business Outcomes</span>
            <h2 className="font-marketing-heading text-2xl sm:text-4xl font-extrabold text-white mt-1">
              One system. Less operational drag.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'Fewer handoffs', desc: 'Customer context moves with the work from lead capture to final billing.', icon: Layers },
              { title: 'Less manual work', desc: 'Routine operational actions move across connected modules automatically.', icon: Zap },
              { title: 'Faster follow-up', desc: 'Opportunities don\'t disappear or cool off between separate tools.', icon: Clock },
              { title: 'One operational view', desc: 'Sales, communication, money, and delivery remain completely connected.', icon: BarChart3 },
            ].map((out, i) => {
              const Icon = out.icon;
              return (
                <div key={i} className="p-5 sm:p-6 rounded-3xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition-all">
                  <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-300 w-fit mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white">{out.title}</h3>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">{out.desc}</p>
                </div>
              );
            })}
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* ── 7. CAPABILITIES BY BUSINESS JOB ── */}
      <MarketingSection id="platform" atmosphere="platform" className="py-12 sm:py-16">
        <MarketingContainer>
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-teal-400">Capabilities</span>
            <h2 className="font-marketing-heading text-2xl sm:text-4xl font-extrabold text-white mt-1">
              Capabilities organized around business jobs.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { job: 'GROW', title: 'Get Customers', items: ['Marketing Hub', 'Lead Generation', 'Campaigns', 'Social Publishing'], icon: Megaphone },
              { job: 'SELL', title: 'Convert Opportunities', items: ['CRM Pipeline', 'Outreach Sequences', 'Calendar & Booking', 'Contact History'], icon: Users },
              { job: 'OPERATE', title: 'Deliver the Work', items: ['Documents', 'Projects & Tasks', 'Communication Hub', 'Team Channels'], icon: Workflow },
              { job: 'GET PAID', title: 'Manage Money', items: ['Invoicing', 'Payment Processing', 'Money Hub', 'POS Integration'], icon: CircleDollarSign },
              { job: 'UNDERSTAND', title: 'Business Visibility', items: ['Reporting', 'Revenue Analytics', 'Goal Tracking', 'Business Intelligence'], icon: BarChart3 },
              { job: 'EXECUTE', title: 'Bonnie AI Assistant', items: ['Cross-Module Actions', 'Contextual Automation', 'Follow-up Generation'], icon: Bot },
            ].map((cap) => {
              const Icon = cap.icon;
              return (
                <div key={cap.job} className="p-6 rounded-3xl border border-slate-800 bg-slate-900/60">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest bg-teal-500/10 text-teal-300 border border-teal-500/20 px-2.5 py-1 rounded-md">
                      {cap.job}
                    </span>
                    <Icon className="w-5 h-5 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white">{cap.title}</h3>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {cap.items.map((item) => (
                      <span key={item} className="rounded-lg bg-slate-950 border border-slate-800/80 px-2.5 py-1 text-xs text-slate-300 font-medium">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* ── 8. TRUST ── */}
      <MarketingSection atmosphere="trust" className="py-12 sm:py-16">
        <MarketingContainer>
          <div className="mx-auto mb-8 max-w-3xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-teal-400">Trust & Architecture</span>
            <h2 className="font-marketing-heading text-2xl sm:text-4xl font-extrabold text-white mt-1">
              Enterprise security. Human control.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 text-center">
              <ShieldCheck className="w-6 h-6 text-teal-400 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-white">Permissions & Security</h4>
              <p className="text-xs text-slate-400 mt-1">Role-based workspace access & encrypted data transit.</p>
            </div>
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 text-center">
              <Lock className="w-6 h-6 text-teal-400 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-white">Human Approval</h4>
              <p className="text-xs text-slate-400 mt-1">Sensitive AI transactions require explicit review before dispatch.</p>
            </div>
            <div className="flex justify-center mt-3">
              <VerifiedIntegrationsStrip />
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* ── 9. FINAL CTA ── */}
      <MarketingSection atmosphere="cta" className="py-16 sm:py-24">
        <MarketingContainer>
          <div className="mx-auto max-w-3xl text-center px-4">
            <h2 className="font-marketing-heading text-3xl sm:text-5xl font-extrabold text-white leading-tight">
              Run your business from one system.
            </h2>
            <p className="mt-4 text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
              Stop moving work between disconnected tools. Keep customers, communication, operations and money connected.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 max-w-md mx-auto sm:max-w-none">
              <PrimaryCTA href={DEMO_HREF} className="w-full sm:w-auto mkt-btn-large">
                See AlphaClone in Action
              </PrimaryCTA>
              <SecondaryCTA href={TRIAL_HREF} className="w-full sm:w-auto mkt-btn-large">
                Explore AlphaClone
              </SecondaryCTA>
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>
    </MarketingShell>
  );
}
