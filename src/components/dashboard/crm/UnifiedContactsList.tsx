'use client';

import { Input as AlphaCloneInput } from '@/components/ui/input';


import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, ChevronLeft, ChevronRight, Mail, Phone, RefreshCw, Search, User } from 'lucide-react';
import { contactService, type ContactWithCompany } from '@/services/contactService';
import { businessClientService, type BusinessClient } from '@/services/businessClientService';
import { useTenant } from '@/contexts/TenantContext';
import type { UnifiedContact } from '@/lib/crm/unifiedContacts';
import EmptyState from '@/components/ui/EmptyState';
import toast from 'react-hot-toast';

type Props = {
  onOpenClient?: (clientId: string) => void;
  onOpenContact?: (contactId: string) => void;
  highlightContactId?: string | null;
};

const PAGE_SIZE = 50;

function contactToUnified(contact: ContactWithCompany): UnifiedContact {
  return {
    id: contact.id,
    tenant_id: contact.tenantId,
    full_name: contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Contact',
    first_name: contact.firstName || '',
    last_name: contact.lastName || '',
    email: contact.email || null,
    phone: contact.phone || null,
    status: contact.status || 'active',
    lifecycle_stage: contact.status || null,
    company_id: contact.company?.id || null,
    business_client_id: null,
    source: 'contacts',
    created_at: contact.createdAt,
  };
}

function clientToUnified(client: BusinessClient, tenantId: string): UnifiedContact {
  const name = (client.name || 'Contact').trim();
  const parts = name.split(/\s+/);
  return {
    id: client.crmContactId || client.id,
    tenant_id: tenantId,
    full_name: name,
    first_name: parts[0] || 'Contact',
    last_name: parts.slice(1).join(' '),
    email: client.email || null,
    phone: client.phone || null,
    status: 'active',
    lifecycle_stage: client.salesStage === 'customer' ? 'customer' : client.salesStage || 'lead',
    company_id: null,
    business_client_id: client.id,
    source: 'business_clients',
    created_at: client.createdAt,
  };
}

export default function UnifiedContactsList({
  onOpenClient,
  onOpenContact,
  highlightContactId,
}: Props) {
  const { currentTenant } = useTenant();
  const [contacts, setContacts] = useState<UnifiedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [contactTotal, setContactTotal] = useState(0);
  const [clientTotal, setClientTotal] = useState(0);
  const [contactPages, setContactPages] = useState(1);
  const [clientHasMore, setClientHasMore] = useState(false);

  const load = useCallback(async () => {
    if (!currentTenant?.id) {
      setContacts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [contactResult, clientResult] = await Promise.all([
        contactService.getContacts({
          search: search.trim() || undefined,
          page,
          limit: PAGE_SIZE,
          sort: 'created_at',
          direction: 'desc',
        }),
        businessClientService.getClients(
          currentTenant.id,
          page,
          PAGE_SIZE,
          false,
          search.trim()
        ),
      ]);

      if (contactResult.error) throw new Error(contactResult.error);

      const canonicalContacts = contactResult.contacts.map(contactToUnified);
      const contactIds = new Set(canonicalContacts.map((row) => row.id));
      const emails = new Set(
        canonicalContacts
          .map((row) => row.email?.trim().toLowerCase())
          .filter((value): value is string => Boolean(value))
      );

      const salesOnly = clientResult.clients
        .filter((client) => {
          if (client.crmContactId && contactIds.has(client.crmContactId)) return false;
          const email = client.email?.trim().toLowerCase();
          if (email && emails.has(email)) return false;
          return Boolean(client.email || client.phone);
        })
        .map((client) => clientToUnified(client, currentTenant.id));

      const merged = [...canonicalContacts, ...salesOnly].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setContacts(merged);
      setContactTotal(contactResult.pagination?.total ?? canonicalContacts.length);
      setContactPages(contactResult.pagination?.pages ?? 1);
      setClientTotal(clientResult.count ?? clientResult.clients.length);
      setClientHasMore(clientResult.clients.length === PAGE_SIZE);
    } catch (err) {
      console.error('Failed to load unified contacts:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to load unified contacts');
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id, page, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, search.trim() ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (!highlightContactId || contacts.length === 0) return;
    const match = contacts.find(
      (row) => row.id === highlightContactId || row.business_client_id === highlightContactId
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

  const hasPrevious = page > 1;
  const hasNext = page < contactPages || clientHasMore;
  const estimatedTotal = useMemo(() => contactTotal + clientTotal, [contactTotal, clientTotal]);

  if (loading && contacts.length === 0) {
    return (
      <EmptyState
        icon={User}
        title="Loading unified contacts"
        description="Loading this page from CRM contacts and sales clients."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="type-ui font-bold text-[var(--ws-text-primary)]">Unified directory</h3>
          <p className="type-card-description text-[var(--ws-text-muted)]">
            CRM contacts and sales clients in one paginated directory. No browser-side 1,000-record ceiling.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ws-text-muted)]" />
            <AlphaCloneInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email or phone"
              className="w-full py-2 pl-9 pr-3"
            />
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 rounded-xl border border-[var(--ws-border)] px-3 py-2 type-caption font-bold text-[var(--ws-text-secondary)]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 type-caption text-[var(--ws-text-muted)]">
        <span>
          Page {page} · {contacts.length} shown
          {estimatedTotal > 0 ? ` · ${estimatedTotal.toLocaleString()} source records` : ''}
        </span>
        <span>50 CRM + 50 sales records fetched per page</span>
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          icon={User}
          title="No contacts on this page"
          description={page > 1 ? 'Go back a page or change the search.' : 'Add a sales client or email contact to populate this directory.'}
        />
      ) : (
        <div className="space-y-2">
          {contacts.map((row) => (
            <button
              key={`${row.source}-${row.id}-${row.business_client_id || 'none'}`}
              type="button"
              onClick={() => openRow(row)}
              className="flex w-full items-center justify-between rounded-xl border border-[var(--ws-border)] bg-[var(--ws-canvas)]/70 px-4 py-3 text-left transition hover:border-teal-500/30"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-[var(--ws-text-primary)]">{row.full_name}</p>
                <p className="truncate type-card-description text-[var(--ws-text-muted)]">
                  {[row.email, row.phone].filter(Boolean).join(' · ') || 'No email or phone'}
                </p>
              </div>
              <div className="ml-3 flex shrink-0 items-center gap-2 type-caption font-bold uppercase tracking-wide text-[var(--ws-text-muted)]">
                {row.email ? <Mail className="h-3.5 w-3.5" /> : null}
                {row.phone ? <Phone className="h-3.5 w-3.5" /> : null}
                {row.company_id ? <Building2 className="h-3.5 w-3.5" /> : null}
                <span className="rounded-md bg-[var(--ws-panel)] px-2 py-1 text-[var(--ws-text-secondary)]">
                  {row.source === 'contacts' ? 'CRM' : 'Sales'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-[var(--ws-border)] pt-4">
        <button
          type="button"
          disabled={!hasPrevious || loading}
          onClick={() => setPage((value) => Math.max(1, value - 1))}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--ws-border)] px-4 py-2 type-ui font-semibold text-[var(--ws-text-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>
        <span className="type-ui font-semibold text-[var(--ws-text-secondary)]">Page {page}</span>
        <button
          type="button"
          disabled={!hasNext || loading}
          onClick={() => setPage((value) => value + 1)}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--ws-border)] px-4 py-2 type-ui font-semibold text-[var(--ws-text-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
