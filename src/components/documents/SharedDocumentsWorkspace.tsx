'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Grid2X2, List, Plus, Search, Upload, X } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { fileUploadService } from '@/services/fileUploadService';
import { PageHeader } from '@/components/dashboard/responsive/PageHeader';
import toast from 'react-hot-toast';

type DocumentRow = {
  id: string;
  name: string;
  description?: string | null;
  document_type?: string | null;
  status: string;
  version: number;
  mime_type?: string | null;
  size_bytes?: number | null;
  approval_status?: string;
  signature_status?: string;
  expiry_date?: string | null;
  updated_at: string;
  metadata?: Record<string, unknown> | null;
  source?: string;
};

type WorkspaceSettings = {
  brand: {
    legal_business_name?: string;
    trading_name?: string | null;
    business_email?: string | null;
    jurisdiction?: string | null;
    default_currency?: string | null;
    updated_at?: string | null;
  } | null;
  retention_default_days: number;
  default_confidentiality: string;
};

const NAV = [
  ['Overview', ''],
  ['All Documents', 'all'],
  ['My Documents', 'mine'],
  ['Shared With Me', 'shared'],
  ['Recent', 'recent'],
  ['Favourites', 'favourites'],
  ['Templates', 'templates'],
  ['Requests', 'requests'],
  ['Approvals', 'approvals'],
  ['Expiring', 'expiring'],
  ['Archive', 'archive'],
  ['Trash', 'trash'],
  ['Settings', 'settings'],
] as const;

function bytes(value?: number | null) {
  if (!value) return '—';
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export default function SharedDocumentsWorkspace({ section = '' }: { section?: string }) {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [grid, setGrid] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const activeSection = NAV.some(([, key]) => key === section) ? section : '';

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ limit: '100', includeDocOs: 'true' });
    if (query.trim()) params.set('q', query.trim());
    if (activeSection === 'all') params.set('view', 'all');
    else if (activeSection) params.set('view', activeSection);
    if (activeSection === 'archive') params.set('status', 'archived');
    try {
      const response = await fetch(
        `/api/tenant/${currentTenant.id}/documents?${params.toString()}`,
        { credentials: 'include' }
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Documents could not be loaded');
      if (activeSection === 'settings') {
        setSettings(payload.settings || null);
        setDocuments([]);
        setTotal(0);
        return;
      }
      setSettings(null);
      let rows: DocumentRow[] = payload.documents || [];
      if (activeSection === 'recent') rows = rows.slice(0, 20);
      if (activeSection === 'expiring') {
        rows = rows.filter((row: DocumentRow) => row.expiry_date);
      }
      setDocuments(rows);
      setTotal(payload.total || rows.length);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Documents could not be loaded');
    } finally {
      setLoading(false);
    }
  }, [activeSection, currentTenant?.id, query]);

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const metrics = useMemo(
    () => ({
      active: documents.filter((d) => !['archived', 'expired', 'template'].includes(d.status)).length,
      review: documents.filter((d) => d.status === 'in_review').length,
      approvals: documents.filter((d) => d.approval_status === 'pending').length,
      signatures: documents.filter((d) =>
        ['sent', 'partially_signed'].includes(d.signature_status || '')
      ).length,
      expiring: documents.filter(
        (d) => d.expiry_date && new Date(d.expiry_date).getTime() < Date.now() + 90 * 86_400_000
      ).length,
      storage: documents.reduce((sum, d) => sum + (d.size_bytes || 0), 0),
    }),
    [documents]
  );

  const createDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentTenant?.id || !name.trim()) return;
    try {
      const response = await fetch(`/api/tenant/${currentTenant.id}/documents`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), documentType: 'general_file', content: '' }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Document could not be created');
      toast.success('Document draft created');
      setName('');
      setCreating(false);
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Document could not be created');
    }
  };

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id || !currentTenant?.id) return;
    const result = await fileUploadService.uploadFile(
      file,
      'documents',
      undefined,
      user.id,
      currentTenant.id
    );
    if (!result.success) toast.error(result.error || 'Upload failed');
    else {
      toast.success('Document uploaded');
      await load();
    }
    event.target.value = '';
  };

  const sectionLabel = NAV.find(([, key]) => key === activeSection)?.[0] || 'Overview';
  const showDocumentList = activeSection !== 'settings';

  return (
    <div className="min-h-0">
      <PageHeader
        moduleLabel={t('Deliver')}
        title={t('Documents')}
        description={t('The shared source of truth for files across your workspace.')}
        breadcrumbs={[{ label: t(sectionLabel) }]}
        primaryAction={{
          label: t('Upload document'),
          onClick: () => inputRef.current?.click(),
          variant: 'primary',
        }}
        secondaryActions={[{ label: t('Create document'), onClick: () => setCreating(true) }]}
      />
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        onChange={upload}
        aria-label={t('Upload document')}
      />
      <nav
        aria-label={t('Documents sections')}
        className="flex gap-1 overflow-x-auto border-b border-[var(--ws-border)] px-3 py-2"
      >
        {NAV.map(([label, key]) => (
          <a
            key={key}
            href={`/dashboard/business/documents${key ? `/${key}` : ''}`}
            aria-current={activeSection === key ? 'page' : undefined}
            className={`min-h-11 shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${
              activeSection === key
                ? 'bg-teal-500/15 text-teal-300'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            {t(label)}
          </a>
        ))}
      </nav>

      <div className="space-y-4 p-3 md:p-5">
        {activeSection === '' && (
          <section aria-label={t('Document metrics')} className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            {(
              [
                ['Active', metrics.active],
                ['In review', metrics.review],
                ['Awaiting approval', metrics.approvals],
                ['Awaiting signature', metrics.signatures],
                ['Expiring soon', metrics.expiring],
                ['Storage', bytes(metrics.storage)],
              ] as Array<[string, string | number]>
            ).map(([label, value]) => (
              <div key={label} className="ac-workspace-panel rounded-xl p-4">
                <p className="text-xs text-slate-400">{t(label)}</p>
                <p className="mt-1 text-xl font-semibold text-white">{value}</p>
              </div>
            ))}
          </section>
        )}

        {activeSection === 'settings' && (
          <section className="ac-workspace-panel rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white">{t('Document workspace settings')}</h2>
            <p className="mt-1 text-sm text-slate-400">
              {t('Brand identity and retention defaults used by Document OS and the shared catalog.')}
            </p>
            {loading ? (
              <p className="mt-6 text-sm text-slate-500">Loading settings…</p>
            ) : (
              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase text-slate-500">Legal business name</dt>
                  <dd className="mt-1 text-sm text-white">
                    {settings?.brand?.legal_business_name || 'Not configured'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Trading name</dt>
                  <dd className="mt-1 text-sm text-white">
                    {settings?.brand?.trading_name || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Business email</dt>
                  <dd className="mt-1 text-sm text-white">
                    {settings?.brand?.business_email || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Jurisdiction</dt>
                  <dd className="mt-1 text-sm text-white">
                    {settings?.brand?.jurisdiction || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Default currency</dt>
                  <dd className="mt-1 text-sm text-white">
                    {settings?.brand?.default_currency || 'USD'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Default confidentiality</dt>
                  <dd className="mt-1 text-sm text-white">
                    {settings?.default_confidentiality || 'internal'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Retention default</dt>
                  <dd className="mt-1 text-sm text-white">
                    {settings?.retention_default_days || 2555} days
                  </dd>
                </div>
              </dl>
            )}
          </section>
        )}

        {showDocumentList && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative min-w-[220px] flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" aria-hidden />
                <span className="sr-only">{t('Search documents')}</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('Search name, number, description…')}
                  className="min-h-11 w-full rounded-lg border border-[var(--ws-border)] bg-slate-950/40 pl-9 pr-3 text-sm text-white focus:border-teal-500 focus:outline-none"
                />
              </label>
              <button
                onClick={() => setGrid(false)}
                aria-label={t('Table view')}
                aria-pressed={!grid}
                className="min-h-11 min-w-11 rounded-lg border border-[var(--ws-border)] p-3 text-slate-300"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setGrid(true)}
                aria-label="Grid view"
                aria-pressed={grid}
                className="min-h-11 min-w-11 rounded-lg border border-[var(--ws-border)] p-3 text-slate-300"
              >
                <Grid2X2 className="h-4 w-4" />
              </button>
            </div>

            {creating && (
              <form
                onSubmit={createDocument}
                className="ac-workspace-panel flex flex-wrap items-end gap-3 rounded-xl p-4"
              >
                <label className="min-w-[240px] flex-1 text-sm text-slate-300">
                  Document name
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={300}
                    className="mt-1 min-h-11 w-full rounded-lg border border-[var(--ws-border)] bg-slate-950/50 px-3 text-white"
                  />
                </label>
                <button className="min-h-11 rounded-lg bg-teal-600 px-4 font-semibold text-white">
                  <Plus className="mr-2 inline h-4 w-4" />
                  Create draft
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  aria-label="Cancel create document"
                  className="min-h-11 min-w-11 rounded-lg border border-[var(--ws-border)] p-3 text-slate-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </form>
            )}

            {loading ? (
              <div className="space-y-2" aria-label="Loading documents">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-white/5" />
                ))}
              </div>
            ) : error ? (
              <div
                role="alert"
                className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-200"
              >
                <p>{error}</p>
                <button onClick={load} className="mt-3 underline">
                  Try again
                </button>
              </div>
            ) : documents.length === 0 ? (
              <div className="ac-workspace-panel rounded-xl p-10 text-center">
                <Upload className="mx-auto h-8 w-8 text-slate-500" />
                <h2 className="mt-3 font-semibold text-white">No documents found</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {activeSection
                    ? `${t('No records in')} ${t(sectionLabel).toLowerCase()} ${t('yet')}.`
                    : 'Upload a file or create a document draft to get started.'}
                </p>
              </div>
            ) : grid ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {documents.map((d) => (
                  <article key={d.id} className="ac-workspace-panel rounded-xl p-4">
                    <FileText className="h-7 w-7 text-teal-400" />
                    <h2 className="mt-3 truncate font-semibold text-white">{d.name}</h2>
                    <p className="mt-1 text-xs text-slate-400">
                      {d.document_type || 'General file'} · v{d.version || 1}
                      {d.source === 'doc_os' ? ' · Doc OS' : ''}
                    </p>
                    <span className="mt-3 inline-block rounded-full bg-white/5 px-2 py-1 text-xs text-slate-300">
                      {d.status}
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[var(--ws-border)]">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="bg-white/[0.03] text-xs uppercase text-slate-400">
                    <tr>
                      <th className="p-3">{t('Name')}</th>
                      <th className="p-3">{t('Type')}</th>
                      <th className="p-3">{t('Status')}</th>
                      <th className="p-3">{t('Version')}</th>
                      <th className="p-3">{t('Approval')}</th>
                      <th className="p-3">{t('Signature')}</th>
                      <th className="p-3">{t('Size')}</th>
                      <th className="p-3">{t('Updated')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((d) => (
                      <tr
                        key={d.id}
                        className="border-t border-[var(--ws-border)] text-slate-300 hover:bg-white/[0.02]"
                      >
                        <td className="p-3 font-medium text-white">
                          {d.name}
                          {d.source === 'doc_os' ? (
                            <span className="ml-2 rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] uppercase text-violet-300">
                              Doc OS
                            </span>
                          ) : null}
                        </td>
                        <td className="p-3">{d.document_type || 'General file'}</td>
                        <td className="p-3">{d.status}</td>
                        <td className="p-3">v{d.version || 1}</td>
                        <td className="p-3">{d.approval_status || 'Not requested'}</td>
                        <td className="p-3">{d.signature_status || 'Not requested'}</td>
                        <td className="p-3">{bytes(d.size_bytes)}</td>
                        <td className="p-3">{new Date(d.updated_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-slate-500">
              {total} tenant-scoped document{total === 1 ? '' : 's'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
