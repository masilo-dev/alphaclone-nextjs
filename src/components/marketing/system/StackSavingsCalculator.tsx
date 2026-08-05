'use client';

import React, { useState } from 'react';
import { Calculator, Check, ArrowRight, DollarSign, Clock, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface ToolItem {
  id: string;
  name: string;
  category: string;
  avgMonthlyCost: number;
  weeklyHoursWasted: number;
}

const DISCONNECTED_TOOLS: ToolItem[] = [
  {
    id: 'crm',
    name: 'HubSpot / Salesforce CRM',
    category: 'Lead Management',
    avgMonthlyCost: 180,
    weeklyHoursWasted: 3.5,
  },
  {
    id: 'esign',
    name: 'DocuSign / PandaDoc',
    category: 'E-Signatures & Contracts',
    avgMonthlyCost: 65,
    weeklyHoursWasted: 2.0,
  },
  {
    id: 'accounting',
    name: 'QuickBooks / Harvest',
    category: 'Invoicing & Time Tracking',
    avgMonthlyCost: 85,
    weeklyHoursWasted: 3.0,
  },
  {
    id: 'video',
    name: 'Zoom / Google Meet Pro',
    category: 'Video Meetings',
    avgMonthlyCost: 25,
    weeklyHoursWasted: 1.0,
  },
  {
    id: 'social',
    name: 'Buffer / Hootsuite',
    category: 'Social Publishing',
    avgMonthlyCost: 55,
    weeklyHoursWasted: 1.5,
  },
  {
    id: 'zapier',
    name: 'Zapier / Make Integrations',
    category: 'App Glue & Webhooks',
    avgMonthlyCost: 75,
    weeklyHoursWasted: 2.0,
  },
];

export default function StackSavingsCalculator() {
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([
    'crm',
    'esign',
    'accounting',
    'video',
    'zapier',
  ]);

  const toggleTool = (id: string) => {
    if (selectedToolIds.includes(id)) {
      if (selectedToolIds.length > 1) {
        setSelectedToolIds(selectedToolIds.filter((t) => t !== id));
      }
    } else {
      setSelectedToolIds([...selectedToolIds, id]);
    }
  };

  const selectedTools = DISCONNECTED_TOOLS.filter((t) => selectedToolIds.includes(t.id));
  const currentMonthlyTotal = selectedTools.reduce((acc, t) => acc + t.avgMonthlyCost, 0);
  const currentAnnualTotal = currentMonthlyTotal * 12;
  const currentHoursWeekly = selectedTools.reduce((acc, t) => acc + t.weeklyHoursWasted, 0);
  const currentHoursAnnual = Math.round(currentHoursWeekly * 50);

  const alphaCloneMonthly = 15;
  const alphaCloneAnnual = alphaCloneMonthly * 12;
  const annualDollarSavings = currentAnnualTotal - alphaCloneAnnual;

  return (
    <div className="w-full py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs sm:text-sm font-medium mb-4">
            <Calculator className="w-4 h-4 text-amber-400" />
            <span>Interactive ROI Calculator</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-4 font-marketing-heading">
            Calculate How Much You Stop Wasting Each Month
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Select the software tools your business currently uses separately to see your instant monthly cost and time savings.
          </p>
        </div>

        {/* Calculator Main Box */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl p-6 sm:p-8 backdrop-blur-md">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Tool Selection List */}
            <div className="lg:col-span-7 space-y-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Select Your Current Disconnected Software Stack:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DISCONNECTED_TOOLS.map((tool) => {
                  const isChecked = selectedToolIds.includes(tool.id);
                  return (
                    <button
                      key={tool.id}
                      onClick={() => toggleTool(tool.id)}
                      className={`p-3.5 rounded-xl border text-left transition-all flex items-start justify-between gap-3 ${
                        isChecked
                          ? 'bg-slate-800 border-teal-500/80 shadow-md ring-1 ring-teal-500/30'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] ${isChecked ? 'bg-teal-500 border-teal-400 text-white' : 'border-slate-700 bg-slate-900'}`}>
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className={`text-xs font-bold ${isChecked ? 'text-white' : 'text-slate-400'}`}>
                            {tool.name}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 pl-6">{tool.category}</p>
                      </div>
                      <span className="text-xs font-mono font-semibold text-slate-300">
                        ${tool.avgMonthlyCost}/mo
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Calculated Savings Box */}
            <div className="lg:col-span-5 flex flex-col justify-between p-6 rounded-xl bg-slate-950 border border-slate-800">
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <span className="text-xs font-bold text-slate-400 uppercase">Current Stack Cost:</span>
                  <div className="text-right">
                    <span className="text-xl font-bold text-rose-400 font-mono">${currentMonthlyTotal} / mo</span>
                    <p className="text-[10px] text-slate-400 font-medium">(${currentAnnualTotal.toLocaleString()} / year)</p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <span className="text-xs font-bold text-slate-400 uppercase">AlphaClone Unified Engine:</span>
                  <div className="text-right">
                    <span className="text-xl font-bold text-teal-400 font-mono">${alphaCloneMonthly} / mo</span>
                    <p className="text-[10px] text-slate-400 font-medium">(${alphaCloneAnnual.toLocaleString()} / year)</p>
                  </div>
                </div>

                {/* Big Savings Highlight */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/40 to-teal-950/40 border border-emerald-500/40">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase mb-1">
                    <Sparkles className="w-4 h-4" />
                    <span>Your Net Annual Savings:</span>
                  </div>
                  <div className="text-3xl font-extrabold text-white font-mono tracking-tight">
                    ${annualDollarSavings.toLocaleString()} <span className="text-sm font-normal text-emerald-300">/ yr saved</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300 mt-2">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Plus <strong className="text-white">{currentHoursAnnual} hours / year</strong> saved on manual re-entry.</span>
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="mt-6 pt-4 border-t border-slate-800">
                <Link
                  href="/auth/login?register=true&plan=starter"
                  className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-teal-950"
                >
                  <span>Start 14-Day Free Trial & Save</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <p className="text-[11px] text-center text-slate-400 mt-2">No credit card required • Instant CSV data import</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
