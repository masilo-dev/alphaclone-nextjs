'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, CircleDot, Map, Save, Search, Sparkles } from 'lucide-react';

const STEPS = [
  {
    letter: 'A',
    title: 'Pick who you want',
    body: 'Enter a business type (dentists, HVAC, marketing agencies). Keep it specific.',
    Icon: Search,
  },
  {
    letter: 'B',
    title: 'Set where + reach',
    body: 'Add a city and choose a reach radius (km). Closer leads score higher.',
    Icon: Map,
  },
  {
    letter: 'C',
    title: 'Watch the scrape',
    body: 'We pull free public data live — OpenStreetMap, Wikidata, directories. Progress shows on the map panel.',
    Icon: CircleDot,
  },
  {
    letter: 'D',
    title: 'Qualify the best',
    body: 'Sort by score/grade. Select A/B leads with phone, email, or website.',
    Icon: Sparkles,
  },
  {
    letter: 'E',
    title: 'Save to CRM',
    body: 'One click syncs selected prospects into your CRM pipeline for outreach.',
    Icon: Save,
  },
];

export default function LeadFinderBeginnerGuide() {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-800/40 transition-colors"
      >
        <div>
          <p className="text-sm font-semibold text-white">Beginner path · A → E</p>
          <p className="text-xs text-slate-400 mt-0.5">
            New here? Follow these five steps to find and save strong leads.
          </p>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        )}
      </button>

      {open && (
        <ol className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2 px-3 pb-3">
          {STEPS.map((step) => (
            <li
              key={step.letter}
              className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-teal-600/20 text-teal-300 text-xs font-bold">
                  {step.letter}
                </span>
                <step.Icon className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <p className="text-xs font-semibold text-white">{step.title}</p>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
