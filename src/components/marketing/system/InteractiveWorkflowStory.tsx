'use client';

import React, { useState } from 'react';
import { AlphaIcon } from '@/components/marketing/icons';
import { ArrowRight, CheckCircle2, ShieldCheck, Zap, Layers, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface WorkflowNode {
  id: string;
  number: string;
  stage: string;
  title: string;
  description: string;
  trigger: string;
  automatedResult: string;
  icon: string;
  accent: string;
  previewSnippet: {
    badge: string;
    headline: string;
    details: Array<{ label: string; value: string }>;
    codeOrNote?: string;
  };
}

const FLOW_NODES: WorkflowNode[] = [
  {
    id: 'lead',
    number: '01',
    stage: 'Prospecting & Intake',
    title: 'Lead Ingestion & CRM Record',
    description: 'Web forms, email inquiries, or LinkedIn discovery automatically generate a unified client profile in CRM without manual entry.',
    trigger: 'Inbound Inquiry Received',
    automatedResult: 'Unified client profile created, owner assigned, initial context logged.',
    icon: 'crm',
    accent: 'border-blue-500/40 text-blue-400 bg-blue-500/10',
    previewSnippet: {
      badge: 'CRM AUTO-INGESTION',
      headline: 'New Prospect: Acme Growth Corp',
      details: [
        { label: 'Contact', value: 'Sarah Jenkins (VP Ops)' },
        { label: 'Source', value: 'Inbound Web Form' },
        { label: 'Estimated Budget', value: '$24,000 / project' },
        { label: 'Status', value: 'Qualified — Discovery Scheduled' },
      ],
      codeOrNote: '✓ Context captured: Needs CRM migration & contract automation by Q3.',
    },
  },
  {
    id: 'proposal',
    number: '02',
    stage: 'Discovery & Scope',
    title: 'AI Proposal Generation',
    description: 'Bonnie AI analyzes discovery notes and historical deal terms to generate a fully customized proposal with itemized pricing.',
    trigger: 'Discovery Meeting Ended',
    automatedResult: 'Itemized proposal draft prepared in under 30 seconds for review.',
    icon: 'bonnie',
    accent: 'border-teal-500/40 text-teal-300 bg-teal-500/10',
    previewSnippet: {
      badge: 'BONNIE AI PROPOSAL ENGINE',
      headline: 'Proposal #PROP-2026-089 Prepared',
      details: [
        { label: 'Scope', value: '4-Week Workspace Onboarding & Workflow Migration' },
        { label: 'Milestones', value: '2 Phase Delivery ($12k / $12k)' },
        { label: 'Timeline', value: 'Aug 15 - Sep 15' },
      ],
      codeOrNote: '⚡ Bonnie AI: Auto-populated custom SLA clause based on client request.',
    },
  },
  {
    id: 'contract',
    number: '03',
    stage: 'Legal Agreement',
    title: 'E-Sign Contract Execution',
    description: 'Proposals convert into legally binding agreements with instant client e-signatures, audit trail logs, and zero DocuSign fees.',
    trigger: 'Proposal Approved',
    automatedResult: 'Contract sent, digital signature captured, audit certificate generated.',
    icon: 'documents',
    accent: 'border-amber-500/40 text-amber-300 bg-amber-500/10',
    previewSnippet: {
      badge: 'E-SIGNATURE ENGINE',
      headline: 'Master Services Agreement — SIGNED',
      details: [
        { label: 'Signer', value: 'Sarah Jenkins (IP: 192.168.1.42)' },
        { label: 'Timestamp', value: 'Jul 29, 2026 — 14:32 UTC' },
        { label: 'Status', value: 'Legally Executed & Archived' },
      ],
      codeOrNote: '🔒 Audit Hash: 0x8f4b...39e1 stored securely in workspace document hub.',
    },
  },
  {
    id: 'project',
    number: '04',
    stage: 'Delivery & Operations',
    title: 'Automated Project Instantiation',
    description: 'Signing a contract immediately generates team deliverable boards, assigns task owners, and sets up milestone dates.',
    trigger: 'Contract Signed Signal',
    automatedResult: 'Project board created, 14 delivery tasks assigned, kickoff scheduled.',
    icon: 'projects',
    accent: 'border-purple-500/40 text-purple-300 bg-purple-500/10',
    previewSnippet: {
      badge: 'PROJECT DELIVERY ENGINE',
      headline: 'Active Delivery: Acme Migration & Setup',
      details: [
        { label: 'Milestone 1', value: 'Data Ingestion & Field Mapping (Due Aug 05)' },
        { label: 'Milestone 2', value: 'Team Onboarding & Testing (Due Aug 20)' },
        { label: 'Progress', value: 'Phase 1 Active — 3 Tasks Assigned' },
      ],
      codeOrNote: '✓ Team notified in workspace timeline. Zero email ping-pong required.',
    },
  },
  {
    id: 'invoice',
    number: '05',
    stage: 'Financial Settlement',
    title: 'Reconciled Invoicing & P&L',
    description: 'Completed milestones generate compliant invoices. Payments via Stripe auto-update workspace financials and revenue reports.',
    trigger: 'Milestone 1 Completed',
    automatedResult: 'Invoice #INV-4089 sent via email, payment received, P&L updated.',
    icon: 'invoicing',
    accent: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10',
    previewSnippet: {
      badge: 'FINANCIAL RECONCILIATION',
      headline: 'Invoice #INV-4089 ($12,000.00)',
      details: [
        { label: 'Payment Status', value: 'PAID VIA STRIPE (Credit Card)' },
        { label: 'Net P&L Ledger', value: '+$12,000 Revenue Reconciled' },
        { label: 'Tax Status', value: 'Compliant & Archived' },
      ],
      codeOrNote: '💰 Financial Snapshot: Monthly target +18% ahead of forecast.',
    },
  },
  {
    id: 'retain',
    number: '06',
    stage: 'Growth & Retention',
    title: 'Client Retention & Intelligence',
    description: 'Ongoing account health monitoring alerts team to renewal opportunities, upcoming milestones, and client feedback loops.',
    trigger: '90-Day Account Review',
    automatedResult: 'Account health score 98/100. Renewal proposal queued for review.',
    icon: 'connected',
    accent: 'border-cyan-500/40 text-cyan-300 bg-cyan-500/10',
    previewSnippet: {
      badge: 'ACCOUNT GOVERNANCE',
      headline: 'Acme Growth Corp — Retained Client',
      details: [
        { label: 'Health Score', value: '98 / 100 (Optimal)' },
        { label: 'Lifetime Value', value: '$48,000.00' },
        { label: 'Next Action', value: 'Annual Maintenance Proposal Drafted' },
      ],
      codeOrNote: '🌟 Automated check-in email queued for client review.',
    },
  },
];

export default function InteractiveWorkflowStory() {
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const activeNode = FLOW_NODES[activeStepIndex];

  return (
    <div className="w-full py-10">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-12 px-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs sm:text-sm font-medium mb-4">
          <Sparkles className="w-4 h-4 text-teal-400" />
          <span>The Connected Business Story</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-4 font-marketing-heading">
          From First Lead to Paid Invoice.{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400">
            One Continuous Flow.
          </span>
        </h2>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
          Instead of running your business across 6 disconnected tools and copy-pasting data manually, AlphaClone executes your entire operational pipeline inside one connected backbone.
        </p>
      </div>

      {/* Workflow Interactive Grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Step Navigation Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mb-8">
          {FLOW_NODES.map((node, index) => {
            const isSelected = activeStepIndex === index;
            return (
              <button
                key={node.id}
                onClick={() => setActiveStepIndex(index)}
                className={`p-3 rounded-xl border text-left transition-all duration-200 relative ${
                  isSelected
                    ? 'bg-slate-900 border-teal-500/80 shadow-lg shadow-teal-950/40 ring-1 ring-teal-500/40'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${isSelected ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' : 'bg-slate-800 text-slate-400'}`}>
                    STEP {node.number}
                  </span>
                  {isSelected && <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping"></span>}
                </div>
                <p className="text-xs font-bold text-white truncate">{node.stage}</p>
              </button>
            );
          })}
        </div>

        {/* Detailed Spotlight Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl p-6 sm:p-8 backdrop-blur-md">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Narrative Description */}
            <div className="lg:col-span-6 space-y-5">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${activeNode.accent}`}>
                  STEP {activeNode.number} OF 06
                </span>
                <span className="text-xs text-slate-400 font-medium">Automatic Hand-off</span>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-white font-marketing-heading">
                  {activeNode.title}
                </h3>
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed mt-2">
                  {activeNode.description}
                </p>
              </div>

              {/* Automation details */}
              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-slate-200">System Trigger</p>
                    <p className="text-xs text-slate-400">{activeNode.trigger}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-teal-950/30 border border-teal-800/40">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-teal-300">Automated Outcome</p>
                    <p className="text-xs text-teal-200/80">{activeNode.automatedResult}</p>
                  </div>
                </div>
              </div>

              {/* Controls & CTA */}
              <div className="flex items-center gap-4 pt-4">
                <button
                  onClick={() => setActiveStepIndex((prev) => (prev + 1) % FLOW_NODES.length)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors flex items-center gap-2 border border-slate-700"
                >
                  <span>Next Flow Step</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <Link
                  href="/auth/login?register=true&plan=starter"
                  className="text-xs text-teal-400 hover:text-teal-300 font-semibold flex items-center gap-1"
                >
                  Test this full flow live →
                </Link>
              </div>
            </div>

            {/* Right Live UI Preview Box */}
            <div className="lg:col-span-6">
              <div className="rounded-xl border border-slate-700/80 bg-slate-950 p-5 shadow-xl relative overflow-hidden">
                {/* Visual Header */}
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                    <span className="ml-2 font-mono text-[11px] text-teal-400 font-semibold">
                      {activeNode.previewSnippet.badge}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/20">
                    REAL-TIME SYNC
                  </span>
                </div>

                {/* Headline */}
                <h4 className="text-base font-bold text-white mb-3">
                  {activeNode.previewSnippet.headline}
                </h4>

                {/* Details Table */}
                <div className="space-y-2 mb-4">
                  {activeNode.previewSnippet.details.map((d) => (
                    <div key={d.label} className="flex justify-between items-center text-xs p-2 rounded bg-slate-900/60 border border-slate-800/60">
                      <span className="text-slate-400 font-medium">{d.label}:</span>
                      <span className="text-slate-200 font-semibold font-mono">{d.value}</span>
                    </div>
                  ))}
                </div>

                {/* Footnote */}
                {activeNode.previewSnippet.codeOrNote && (
                  <div className="p-2.5 rounded bg-slate-900 border border-teal-500/30 text-[11px] font-mono text-teal-300">
                    {activeNode.previewSnippet.codeOrNote}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
