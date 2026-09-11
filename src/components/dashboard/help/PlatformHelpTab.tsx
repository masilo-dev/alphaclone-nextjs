'use client';

import React, { useMemo, useState } from 'react';
import { BookOpen, Search, ChevronRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { ModulePageLayout } from '@/components/ui/ModulePageLayout';
import {
  PLATFORM_HELP_INTRO,
  PLATFORM_HELP_SECTIONS,
  type PlatformHelpSection,
} from '@/config/platformGlossary';
import { APP_NAME } from '@/constants';

export default function PlatformHelpTab() {
  const [query, setQuery] = useState('');

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PLATFORM_HELP_SECTIONS;

    return PLATFORM_HELP_SECTIONS.map((section) => ({
      ...section,
      entries: section.entries.filter(
        (entry) =>
          entry.term.toLowerCase().includes(q) ||
          entry.plainLanguage.toLowerCase().includes(q) ||
          entry.whereToFind.toLowerCase().includes(q)
      ),
    })).filter((section) => section.entries.length > 0) as PlatformHelpSection[];
  }, [query]);

  return (
    <ModulePageLayout
      header={
        <div className="px-1 pb-2">
          <h1 className="text-xl font-semibold text-white">Platform guide</h1>
          <p className="text-sm text-slate-400 mt-1">Learn {APP_NAME} — terms, hubs, and where to work</p>
        </div>
      }
      toolbar={
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search terms…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
            aria-label="Search platform guide"
          />
        </div>
      }
    >
      <div className="space-y-6 pb-20 px-1">
        <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-4 flex gap-3">
          <BookOpen className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" aria-hidden />
          <p className="text-sm text-slate-200 leading-relaxed">{PLATFORM_HELP_INTRO}</p>
        </div>

        <p className="text-xs text-slate-500">
          Public documentation:{' '}
          <Link href="/docs" className="text-teal-400 hover:text-teal-300 inline-flex items-center gap-1">
            /docs
            <ExternalLink className="w-3 h-3" aria-hidden />
          </Link>
        </p>

        {filteredSections.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-12">No matches for &ldquo;{query}&rdquo;.</p>
        ) : (
          filteredSections.map((section) => (
            <section key={section.id} className="space-y-3">
              <div>
                <h2 className="text-base font-semibold text-white">{section.title}</h2>
                {section.description ? (
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{section.description}</p>
                ) : null}
              </div>
              <div className="divide-y divide-white/5 rounded-xl border border-white/5 bg-slate-900/40 overflow-hidden">
                {section.entries.map((entry) => (
                  <div key={entry.term} className="p-4 hover:bg-white/[0.02] transition-colors">
                    <p className="text-sm font-semibold text-teal-300">{entry.term}</p>
                    <p className="text-sm text-slate-300 mt-1 leading-relaxed">{entry.plainLanguage}</p>
                    <p className="text-xs text-slate-500 mt-2 flex items-start gap-1">
                      <ChevronRight className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-600" aria-hidden />
                      {entry.whereToFind}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </ModulePageLayout>
  );
}
