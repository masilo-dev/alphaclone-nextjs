'use client';

import React from 'react';
import {
  DOCUMENT_THEME_PRESETS,
  type DocumentThemeId,
} from '@/lib/documents/renderDocument';
import { cn } from '@/lib/utils';

type DocumentThemePickerProps = {
  value: DocumentThemeId;
  onChange: (themeId: DocumentThemeId) => void;
  className?: string;
};

export function DocumentThemePicker({ value, onChange, className }: DocumentThemePickerProps) {
  const themes = Object.values(DOCUMENT_THEME_PRESETS);

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
        Document theme
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
        {themes.map((theme) => (
          <button
            key={theme.id}
            type="button"
            onClick={() => onChange(theme.id)}
            className={cn(
              'rounded-xl border p-2.5 text-left transition-all',
              value === theme.id
                ? 'border-teal-500/50 bg-teal-500/10 ring-1 ring-teal-500/30'
                : 'border-slate-800 bg-slate-950/50 hover:border-slate-600'
            )}
          >
            <div
              className="h-8 rounded-lg mb-2"
              style={{
                background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.accentColor})`,
              }}
            />
            <p className="text-[11px] font-semibold text-white truncate">{theme.name}</p>
            <div className="flex gap-1 mt-1">
              <span className="w-3 h-3 rounded-full" style={{ background: theme.primaryColor }} />
              <span className="w-3 h-3 rounded-full" style={{ background: theme.accentColor }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
