'use client';

import React from 'react';
import Link from 'next/link';
import { Copy, FileText, Sparkles } from 'lucide-react';
import { DOCUMENT_THEME_PRESETS } from '@/lib/documents/renderDocument';

const INDUSTRY_TEMPLATES = [
  { name: 'Consulting Proposal', type: 'proposal', industry: 'consulting' },
  { name: 'Agency Quote', type: 'quote', industry: 'agency' },
  { name: 'Freelance Invoice', type: 'invoice', industry: 'freelance' },
  { name: 'Service Contract', type: 'contract', industry: 'services' },
  { name: 'Construction Estimate', type: 'quote', industry: 'construction' },
  { name: 'Legal NDA', type: 'contract', industry: 'legal' },
];

export function TemplateLibrary() {
  const themes = Object.values(DOCUMENT_THEME_PRESETS);

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-[13px] font-semibold text-[var(--ws-text-primary)] mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-teal-400" aria-hidden="true" />
          Premium themes
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {themes.map((theme) => (
            <div
              key={theme.id}
              className="ac-workspace-panel p-3 cursor-pointer hover:border-teal-500/30 transition-colors"
              style={{ borderTopColor: theme.accentColor, borderTopWidth: 3 }}
            >
              <p className="text-[12px] font-medium text-[var(--ws-text-primary)]">{theme.name}</p>
              <div className="flex gap-1 mt-2">
                <span className="w-4 h-4 rounded-full" style={{ background: theme.primaryColor }} />
                <span className="w-4 h-4 rounded-full" style={{ background: theme.accentColor }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-[13px] font-semibold text-[var(--ws-text-primary)] mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-teal-400" aria-hidden="true" />
          Template library
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {INDUSTRY_TEMPLATES.map((tpl) => (
            <div
              key={tpl.name}
              className="ac-workspace-panel p-3 flex items-center justify-between gap-2 hover:border-teal-500/30 transition-colors"
            >
              <div>
                <p className="text-[12px] font-medium text-[var(--ws-text-primary)]">{tpl.name}</p>
                <p className="text-[10px] text-[var(--ws-text-tertiary)] capitalize">{tpl.industry} · {tpl.type}</p>
              </div>
              <Link
                href={`/dashboard/business/documents?template=${encodeURIComponent(tpl.name)}`}
                className="ac-workspace-action-btn ac-workspace-action-btn--secondary text-[11px] min-h-8 px-2.5 flex items-center gap-1"
              >
                <Copy className="w-3 h-3" aria-hidden="true" />
                Use
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default TemplateLibrary;
