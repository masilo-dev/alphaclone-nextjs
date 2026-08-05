'use client';

import React, { useState } from 'react';
import { Sparkles, FileText, Check, Copy, Printer, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProposalItem {
  name: string;
  hours: number;
  rate: number;
}

export function AIProposalGenerator() {
  const [clientName, setClientName] = useState('Acme Corporation');
  const [projectTitle, setProjectTitle] = useState('Enterprise Cloud Migration & AI Optimization');
  const [items, setItems] = useState<ProposalItem[]>([
    { name: 'Architecture Design & Setup', hours: 40, rate: 150 },
    { name: 'Data Pipeline & CRM Integration', hours: 60, rate: 150 },
    { name: 'Security & E-Signature Setup', hours: 20, rate: 150 },
  ]);
  const [generating, setGenerating] = useState(false);
  const [proposalMarkdown, setProposalMarkdown] = useState<string>('');

  const totalValue = items.reduce((sum, item) => sum + item.hours * item.rate, 0);

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      const generated = `# PROJECT PROPOSAL: ${projectTitle.toUpperCase()}
**Prepared For:** ${clientName}
**Date:** ${new Date().toLocaleDateString()}
**Estimated Total:** $${totalValue.toLocaleString()} USD

---

## 1. Executive Summary
AlphaClone Systems proposes a comprehensive digital transformation initiative tailored for **${clientName}**. Our solution modernizes infrastructure, automates lead outreach, and integrates zero-cost enterprise management tools.

## 2. Scope of Work & Pricing Breakdown
${items.map(i => `- **${i.name}**: ${i.hours} hours @ $${i.rate}/hr = **$${(i.hours * i.rate).toLocaleString()}**`).join('\n')}

---
**Total Investment:** $${totalValue.toLocaleString()} USD

## 3. Terms & Acceptance
This proposal remains valid for 30 days. Upon acceptance, an official contract will be executed for digital signature.`;

      setProposalMarkdown(generated);
      setGenerating(false);
      toast.success('AI Proposal generated successfully!');
    }, 600);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(proposalMarkdown);
    toast.success('Proposal copied to clipboard');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="ac-workspace-panel rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Sparkles size={15} className="text-purple-400" /> AI Proposal & Pitch Deck Generator
          </h4>
          <p className="text-[11px] text-slate-400">Instantly generate structured proposals & scope of work</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-purple-600 hover:bg-purple-500 transition-colors shadow-lg shadow-purple-500/20"
        >
          <Sparkles size={13} /> {generating ? 'Generating...' : 'Generate Proposal'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Client Name
          </label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs font-bold outline-none focus:border-purple-500/50"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Project Title
          </label>
          <input
            type="text"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs font-bold outline-none focus:border-purple-500/50"
          />
        </div>
      </div>

      {proposalMarkdown && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300">
              Generated Proposal Preview
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-white transition-colors"
              >
                <Copy size={12} /> Copy
              </button>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-white transition-colors"
              >
                <Printer size={12} /> Print PDF
              </button>
            </div>
          </div>
          <pre className="p-4 bg-slate-950 border border-white/10 rounded-xl text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
            {proposalMarkdown}
          </pre>
        </div>
      )}
    </div>
  );
}
