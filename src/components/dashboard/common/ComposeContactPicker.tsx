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
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--ws-border)] bg-[var(--ws-surface-secondary)]/80 type-caption font-bold uppercase tracking-wider text-[var(--brand-blue-300)] hover:bg-[var(--ws-surface-secondary)] hover:text-teal-200 transition-colors"
      >
        <UserPlus className="w-3.5 h-3.5" />
        Pick contact
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full min-w-[280px] max-w-md rounded-xl border border-[var(--ws-border)] bg-[var(--ws-panel)] shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-[var(--ws-border)] flex items-center gap-2">
            <Search className="w-4 h-4 text-[var(--ws-text-muted)] shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search CRM contacts..."
              className="flex-1 bg-transparent type-ui text-white placeholder:text-[var(--ws-text-muted)] focus:outline-none"
              autoFocus
            />
            <button type="button" onClick={() => setOpen(false)} className="text-[var(--ws-text-muted)] hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <p className="p-3 type-card-description text-[var(--ws-text-muted)]">Loading contacts...</p>
            ) : withEmail.length === 0 ? (
              <p className="p-3 type-card-description text-[var(--ws-text-muted)]">No contacts with email found.</p>
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
                  className="w-full text-left px-3 py-2.5 hover:bg-[var(--ws-surface-secondary)] border-b border-[var(--ws-border)]/50 last:border-0"
                >
                  <div className="type-ui font-medium text-white truncate">{c.name || 'Unnamed'}</div>
                  <div className="type-caption text-[var(--ws-text-muted)] truncate">{c.email}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
