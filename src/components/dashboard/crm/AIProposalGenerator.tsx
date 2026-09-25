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

  const handleGenerate = async () => {
    setGenerating(true);
    const prompt = `You are a professional business proposal writer. Generate a structured, client-ready proposal document in markdown format.

Client Name: ${clientName}
Project Title: ${projectTitle}
Line Items:
${items.map(i => `- ${i.name}: ${i.hours} hours @ $${i.rate}/hr = $${(i.hours * i.rate).toLocaleString()}`).join('\n')}
Total Value: $${totalValue.toLocaleString()} USD

Instructions:
- Write a compelling executive summary tailored to the client
- Include a clear scope of work section with the line items above  
- Add professional terms & conditions
- Keep language business-professional and persuasive
- Format in clean markdown suitable for PDF export`;

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, maxTokens: 1200 }),
      });
      if (!res.ok) throw new Error('Generation failed');
      const data = await res.json();
      const generated = data.content || data.text || data.response || '';
      if (generated) {
        setProposalMarkdown(generated.trim());
        toast.success('AI-generated proposal ready.');
      } else {
        throw new Error('Empty response');
      }
    } catch {
      // Fallback: generate locally from fields
      const fallback = `# PROJECT PROPOSAL: ${projectTitle.toUpperCase()}
**Prepared For:** ${clientName}
**Date:** ${new Date().toLocaleDateString()}
**Estimated Total:** $${totalValue.toLocaleString()} USD

---

## 1. Executive Summary
We propose a comprehensive solution tailored for **${clientName}**. Our approach modernises your infrastructure and delivers measurable business outcomes aligned to your goals.

## 2. Scope of Work & Pricing Breakdown
${items.map(i => `- **${i.name}**: ${i.hours} hours @ $${i.rate}/hr = **$${(i.hours * i.rate).toLocaleString()}**`).join('\n')}

---
**Total Investment:** $${totalValue.toLocaleString()} USD

## 3. Terms & Acceptance
This proposal remains valid for 30 days. Upon acceptance, an official contract will be executed for digital signature.`;
      setProposalMarkdown(fallback);
      toast.success('Proposal generated from your inputs.');
    } finally {
      setGenerating(false);
    }
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
          <h4 className="type-caption font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Sparkles size={15} className="text-purple-400" /> AI Proposal & Pitch Deck Generator
          </h4>
          <p className="type-card-description text-slate-400">Instantly generate structured proposals & scope of work</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl type-caption font-black uppercase tracking-wider text-white bg-purple-600 hover:bg-purple-500 transition-colors shadow-lg shadow-purple-500/20"
        >
          <Sparkles size={13} /> {generating ? 'Generating...' : 'Generate Proposal'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block type-caption font-bold uppercase tracking-wider text-slate-400 mb-1">
            Client Name
          </label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white type-caption font-bold outline-none focus:border-purple-500/50"
          />
        </div>
        <div>
          <label className="block type-caption font-bold uppercase tracking-wider text-slate-400 mb-1">
            Project Title
          </label>
          <input
            type="text"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white type-caption font-bold outline-none focus:border-purple-500/50"
          />
        </div>
      </div>

      {proposalMarkdown && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="type-caption font-bold uppercase tracking-wider text-purple-300">
              Generated Proposal Preview
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 type-ui font-bold text-slate-400 hover:text-white transition-colors"
              >
                <Copy size={12} /> Copy
              </button>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1 type-ui font-bold text-slate-400 hover:text-white transition-colors"
              >
                <Printer size={12} /> Print PDF
              </button>
            </div>
          </div>
          <pre className="p-4 bg-slate-950 border border-white/10 rounded-xl type-caption text-slate-300 whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
            {proposalMarkdown}
          </pre>
        </div>
      )}
    </div>
  );
}
