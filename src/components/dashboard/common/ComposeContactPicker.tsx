'use client';

import React, { useMemo, useState } from 'react';
import { Search, UserPlus, X } from 'lucide-react';
import { useClients } from '@/hooks/useClients';

type ComposeContactPickerProps = {
  tenantId: string | undefined;
  onSelect: (email: string, name: string) => void;
  className?: string;
};

export function ComposeContactPicker({ tenantId, onSelect, className = '' }: ComposeContactPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { clients, isLoading } = useClients(tenantId, { limit: 200 });

  const withEmail = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients
      .filter((c) => c.email && c.email.includes('@'))
      .filter((c) => {
        if (!q) return true;
        return (
          (c.name || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 12);
  }, [clients, query]);

  if (!tenantId) return null;

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-xs font-bold uppercase tracking-wider text-teal-300 hover:bg-slate-800 hover:text-teal-200 transition-colors"
      >
        <UserPlus className="w-3.5 h-3.5" />
        Pick contact
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full min-w-[280px] max-w-md rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-slate-800 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search CRM contacts..."
              className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
              autoFocus
            />
            <button type="button" onClick={() => setOpen(false)} className="text-slate-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <p className="p-3 text-xs text-slate-500">Loading contacts...</p>
            ) : withEmail.length === 0 ? (
              <p className="p-3 text-xs text-slate-500">No contacts with email found.</p>
            ) : (
              withEmail.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onSelect(String(c.email), c.name || c.email || 'Contact');
                    setOpen(false);
                    setQuery('');
                  }}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-800 border-b border-slate-800/50 last:border-0"
                >
                  <div className="text-sm font-medium text-white truncate">{c.name || 'Unnamed'}</div>
                  <div className="text-xs text-slate-400 truncate">{c.email}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
