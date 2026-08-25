'use client';

import React from 'react';
import { XCircle, CheckCircle2, Shield, Layers, HelpCircle } from 'lucide-react';
import Link from 'next/link';

interface MatrixRow {
  category: string;
  disconnectedWay: string;
  alphaCloneWay: string;
}

const COMPARISON_ROWS: MatrixRow[] = [
  {
    category: 'Architecture & Data',
    disconnectedWay: '7 isolated databases across CRM, E-sign, Invoicing, and Projects. Manual copy-pasting required.',
    alphaCloneWay: '1 living database core. Leads convert into contracts, delivery tasks, and invoices automatically.',
  },
  {
    category: 'Lead-to-Cash Speed',
    disconnectedWay: 'Slow manual handoffs. Days wasted chasing signatures, setting up project boards, and creating invoices.',
    alphaCloneWay: 'Under 60 seconds. E-signing a proposal automatically instantiates project delivery boards and sets up billing.',
  },
  {
    category: 'Artificial Intelligence',
    disconnectedWay: 'Generic AI chatbots living in separate browser tabs with zero knowledge of your actual client records.',
    alphaCloneWay: 'Bonnie AI powered by MCP. Reads real workspace data and executes operational tasks with owner approval.',
  },
  {
    category: 'E-Signatures & Proposals',
    disconnectedWay: 'Pay $400+/yr for third-party e-sign tools (DocuSign, PandaDoc) that lock signed PDFs away.',
    alphaCloneWay: 'Built-in legally binding e-signatures with cryptographic audit hashing directly linked to client records.',
  },
  {
    category: 'Financial Ledger & P&L',
    disconnectedWay: 'Separate QuickBooks or Xero billing that requires manual reconciliation after project milestones.',
    alphaCloneWay: 'Real-time financial reconciliation. Invoices generated from milestones update your live P&L ledger.',
  },
  {
    category: 'Software Cost & Overhead',
    disconnectedWay: '$500 to $800 / month per user across multiple SaaS subscriptions + Zapier integration fees.',
    alphaCloneWay: 'Starting at $15 / month. Full access to CRM, contracts, projects, billing, video calls, and AI.',
  },
];

export default function DifferentiationMatrix() {
  return (
    <div className="w-full py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm font-medium mb-4">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>Why Switching Makes Sense</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-4 font-marketing-heading">
            Why Modern Service Firms Choose{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400">
              AlphaClone
            </span>
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Stop forcing your team to bridge disconnected software with spreadsheets and manual updates. See how AlphaClone compares to the traditional fragmented SaaS stack.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl overflow-hidden backdrop-blur-md">
          {/* Table Header */}
          <div className="grid grid-cols-1 md:grid-cols-12 bg-slate-950 border-b border-slate-800 p-4 sm:p-6 text-xs sm:text-sm font-bold uppercase tracking-wider">
            <div className="md:col-span-3 text-slate-400">Operational Capability</div>
            <div className="md:col-span-4 text-rose-400 flex items-center gap-2 mt-2 md:mt-0">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>Disconnected SaaS Stack</span>
            </div>
            <div className="md:col-span-5 text-emerald-400 flex items-center gap-2 mt-2 md:mt-0">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>AlphaClone Autonomous Engine</span>
            </div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-800/60">
            {COMPARISON_ROWS.map((row, i) => (
              <div
                key={row.category}
                className={`grid grid-cols-1 md:grid-cols-12 p-4 sm:p-6 items-start gap-4 transition-colors ${
                  i % 2 === 0 ? 'bg-slate-900/40' : 'bg-slate-950/40'
                }`}
              >
                <div className="md:col-span-3">
                  <span className="text-sm font-bold text-white font-marketing-heading">{row.category}</span>
                </div>
                <div className="md:col-span-4 p-3.5 rounded-xl bg-rose-950/20 border border-rose-900/30 text-xs sm:text-sm text-slate-300 leading-relaxed">
                  <p className="text-rose-400 font-semibold mb-1 text-[11px] uppercase tracking-wider">The Old Siloed Way</p>
                  {row.disconnectedWay}
                </div>
                <div className="md:col-span-5 p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-xs sm:text-sm text-slate-100 font-medium leading-relaxed shadow-sm">
                  <p className="text-emerald-400 font-semibold mb-1 text-[11px] uppercase tracking-wider">The AlphaClone Way</p>
                  {row.alphaCloneWay}
                </div>
              </div>
            ))}
          </div>

          {/* Table Bottom Callout */}
          <div className="p-6 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-300">
              <Shield className="w-5 h-5 text-teal-400 shrink-0" />
              <span>Replace HubSpot, DocuSign, QuickBooks, Harvest & Zoom with 1 unified platform.</span>
            </div>
            <Link
              href="/auth/login?register=true&plan=starter"
              className="shrink-0 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs sm:text-sm transition-colors shadow-lg shadow-teal-950"
            >
              Start Free 14-Day Trial →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
