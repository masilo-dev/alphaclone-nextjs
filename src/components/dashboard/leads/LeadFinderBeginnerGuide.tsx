'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, CircleDot, Map, Save, Search, Target } from 'lucide-react';

const STEPS = [
  {
    letter: 'A',
    title: 'Pick who you want',
    body: 'Business type (dentists, HVAC, agencies).',
    Icon: Search,
  },
  {
    letter: 'B',
    title: 'Set where + reach',
    body: 'City + radius (km). Closer scores higher.',
    Icon: Map,
  },
  {
    letter: 'C',
    title: 'Watch the scrape',
    body: 'Live free public data on the map panel.',
    Icon: CircleDot,
  },
  {
    letter: 'D',
    title: 'Qualify the best',
    body: 'Sort by score. Prefer phone or email.',
    Icon: Target,
  },
  {
    letter: 'E',
    title: 'Save to CRM',
    body: 'Sync selected prospects in one click.',
    Icon: Save,
  },
];

/** Collapsed by default so search stays above the fold. */
export default function LeadFinderBeginnerGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-800/40 transition-colors"
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white">Beginner path · A → E</p>
          {!open ? (
            <p className="text-[11px] text-slate-500 truncate">
              Niche → location → scrape → qualify → CRM
            </p>
          ) : null}
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        )}
      </button>

      {open ? (
        <ol className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-1.5 px-2 pb-2">
          {STEPS.map((step) => (
            <li
              key={step.letter}
              className="rounded-md border border-slate-800 bg-slate-950/60 px-2.5 py-2"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-teal-600/20 text-teal-300 text-[10px] font-bold">
                  {step.letter}
                </span>
                <step.Icon className="w-3 h-3 text-slate-400" />
              </div>
              <p className="text-[11px] font-semibold text-white leading-tight">{step.title}</p>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{step.body}</p>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
