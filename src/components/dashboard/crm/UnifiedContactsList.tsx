'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, Mail, Phone, RefreshCw, Search, User } from 'lucide-react';
import { contactService } from '@/services/contactService';
import type { UnifiedContact } from '@/lib/crm/unifiedContacts';
import EmptyState from '@/components/ui/EmptyState';
import toast from 'react-hot-toast';

type Props = {
  onOpenClient?: (clientId: string) => void;
  onOpenContact?: (contactId: string) => void;
  highlightContactId?: string | null;
};

export default function UnifiedContactsList({
  onOpenClient,
  onOpenContact,
  highlightContactId,
}: Props) {
  const [contacts, setContacts] = useState<UnifiedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { contacts: rows, error } = await contactService.getUnifiedContactsList({
      limit: 200,
      search: search.trim() || undefined,
    });
    if (error) toast.error(error);
    setContacts(rows);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!highlightContactId || contacts.length === 0) return;
    const match = contacts.find(
      (row) =>
        row.id === highlightContactId || row.business_client_id === highlightContactId
    );
    if (!match) return;
    if (match.business_client_id) {
      onOpenClient?.(match.business_client_id);
      return;
    }
    onOpenContact?.(match.id);
  }, [highlightContactId, contacts, onOpenClient, onOpenContact]);

  const openRow = (row: UnifiedContact) => {
    if (row.business_client_id) {
      onOpenClient?.(row.business_client_id);
      return;
    }
    onOpenContact?.(row.id);
  };

  if (loading) {
    return (
      <EmptyState
        icon={User}
        title="Loading unified contacts"
        description="Merging CRM contacts and sales clients into one directory."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Unified directory</h3>
          <p className="text-xs text-slate-500">
            Canonical CRM contacts merged with sales clients missing a linked row.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or email"
              className="w-full rounded-xl border border-white/10 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white"
            />
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-300"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          icon={User}
          title="No contacts yet"
          description="Add a sales client or email contact to populate this directory."
        />
      ) : (
        <div className="space-y-2">
          {contacts.map((row) => (
            <button
              key={`${row.source}-${row.id}-${row.business_client_id || 'none'}`}
              type="button"
              onClick={() => openRow(row)}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-left transition hover:border-teal-500/30"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{row.full_name}</p>
                <p className="truncate text-xs text-slate-400">
                  {[row.email, row.phone].filter(Boolean).join(' · ') || 'No email or phone'}
                </p>
              </div>
              <div className="ml-3 flex shrink-0 items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                {row.email ? <Mail className="h-3.5 w-3.5" /> : null}
                {row.phone ? <Phone className="h-3.5 w-3.5" /> : null}
                {row.company_id ? <Building2 className="h-3.5 w-3.5" /> : null}
                <span className="rounded-md bg-slate-900 px-2 py-1 text-slate-300">
                  {row.source === 'contacts' ? 'CRM' : 'Sales'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
