'use client';

import { Input as AlphaCloneInput } from '@/components/ui/input';


import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const documentId = searchParams?.get('documentId');
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

  useEffect(() => {
    if (!currentTenant?.id || !documentId) {
      setSelectedDocument(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    fetch(`/api/tenant/${currentTenant.id}/documents/${encodeURIComponent(documentId)}`, {
      credentials: 'include',
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Document could not be loaded');
        if (!cancelled) setSelectedDocument(payload);
      })
      .catch((caught) => {
        if (!cancelled) toast.error(caught instanceof Error ? caught.message : 'Document could not be loaded');
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentTenant?.id, documentId]);

  const openDocument = useCallback((id: string) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('documentId', id);
    router.replace(`/dashboard/business/documents?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const closeDocument = useCallback(() => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.delete('documentId');
    router.replace(`/dashboard/business/documents${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
  }, [router, searchParams]);

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
            className={`min-h-11 shrink-0 rounded-lg px-3 py-2 type-ui font-medium ${
              activeSection === key
                ? 'bg-teal-500/15 text-[var(--brand-blue-300)]'
                : 'text-[var(--ws-text-muted)] hover:bg-white/5 hover:text-white'
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
                <p className="type-card-description text-[var(--ws-text-muted)]">{t(label)}</p>
                <p className="mt-1 text-xl font-semibold text-white">{value}</p>
              </div>
            ))}
          </section>
        )}

        {activeSection === 'settings' && (
          <section className="ac-workspace-panel rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white">{t('Document workspace settings')}</h2>
            <p className="mt-1 type-card-description text-[var(--ws-text-muted)]">
              {t('Brand identity and retention defaults used by Document OS and the shared catalog.')}
            </p>
            {loading ? (
              <p className="mt-6 type-card-description text-[var(--ws-text-muted)]">Loading settings…</p>
            ) : (
              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="type-caption uppercase text-[var(--ws-text-muted)]">Legal business name</dt>
                  <dd className="mt-1 type-ui text-white">
                    {settings?.brand?.legal_business_name || 'Not configured'}
                  </dd>
                </div>
                <div>
                  <dt className="type-caption uppercase text-[var(--ws-text-muted)]">Trading name</dt>
                  <dd className="mt-1 type-ui text-white">
                    {settings?.brand?.trading_name || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="type-caption uppercase text-[var(--ws-text-muted)]">Business email</dt>
                  <dd className="mt-1 type-ui text-white">
                    {settings?.brand?.business_email || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="type-caption uppercase text-[var(--ws-text-muted)]">Jurisdiction</dt>
                  <dd className="mt-1 type-ui text-white">
                    {settings?.brand?.jurisdiction || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="type-caption uppercase text-[var(--ws-text-muted)]">Default currency</dt>
                  <dd className="mt-1 type-ui text-white">
                    {settings?.brand?.default_currency || 'USD'}
                  </dd>
                </div>
                <div>
                  <dt className="type-caption uppercase text-[var(--ws-text-muted)]">Default confidentiality</dt>
                  <dd className="mt-1 type-ui text-white">
                    {settings?.default_confidentiality || 'internal'}
                  </dd>
                </div>
                <div>
                  <dt className="type-caption uppercase text-[var(--ws-text-muted)]">Retention default</dt>
                  <dd className="mt-1 type-ui text-white">
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
                <Search className="absolute left-3 top-3 h-4 w-4 text-[var(--ws-text-muted)]" aria-hidden />
                <span className="sr-only">{t('Search documents')}</span>
                <AlphaCloneInput
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('Search name, number, description…')}
                  className="min-h-11 w-full pl-9 pr-3"
                />
              </label>
              <button
                onClick={() => setGrid(false)}
                aria-label={t('Table view')}
                aria-pressed={!grid}
                className="min-h-11 min-w-11 rounded-lg border border-[var(--ws-border)] p-3 text-[var(--ws-text-secondary)]"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setGrid(true)}
                aria-label="Grid view"
                aria-pressed={grid}
                className="min-h-11 min-w-11 rounded-lg border border-[var(--ws-border)] p-3 text-[var(--ws-text-secondary)]"
              >
                <Grid2X2 className="h-4 w-4" />
              </button>
            </div>

            {creating && (
              <form
                onSubmit={createDocument}
                className="ac-workspace-panel flex flex-wrap items-end gap-3 rounded-xl p-4"
              >
                <label className="min-w-[240px] flex-1 type-label text-[var(--ws-text-secondary)]">
                  Document name
                  <AlphaCloneInput
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={300}
                    className="mt-1 min-h-11 w-full px-3"
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
                  className="min-h-11 min-w-11 rounded-lg border border-[var(--ws-border)] p-3 text-[var(--ws-text-secondary)]"
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
                className="rounded-xl border border-red-500/30 bg-[var(--error-500)]/10 p-5 text-red-200"
              >
                <p>{error}</p>
                <button onClick={load} className="mt-3 underline">
                  Try again
                </button>
              </div>
            ) : documents.length === 0 ? (
              <div className="ac-workspace-panel rounded-xl p-10 text-center">
                <Upload className="mx-auto h-8 w-8 text-[var(--ws-text-muted)]" />
                <h2 className="mt-3 font-semibold text-white">No documents found</h2>
                <p className="mt-1 type-card-description text-[var(--ws-text-muted)]">
                  {activeSection
                    ? `${t('No records in')} ${t(sectionLabel).toLowerCase()} ${t('yet')}.`
                    : 'Upload a file or create a document draft to get started.'}
                </p>
              </div>
            ) : grid ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {documents.map((d) => (
                  <article key={d.id} onClick={() => openDocument(d.id)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openDocument(d.id); }} className="ac-workspace-panel cursor-pointer rounded-xl p-4 hover:border-teal-500/30">
                    <FileText className="h-7 w-7 text-teal-400" />
                    <h2 className="mt-3 truncate font-semibold text-white">{d.name}</h2>
                    <p className="mt-1 type-card-description text-[var(--ws-text-muted)]">
                      {d.document_type || 'General file'} · v{d.version || 1}
                      {d.source === 'doc_os' ? ' · Doc OS' : ''}
                    </p>
                    <span className="mt-3 inline-block rounded-full bg-white/5 px-2 py-1 type-caption text-[var(--ws-text-secondary)]">
                      {d.status}
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[var(--ws-border)]">
                <table className="w-full min-w-[850px] text-left type-ui">
                  <thead className="bg-white/[0.03] type-caption uppercase text-[var(--ws-text-muted)]">
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
                        onClick={() => openDocument(d.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openDocument(d.id); }}
                        className="cursor-pointer border-t border-[var(--ws-border)] text-[var(--ws-text-secondary)] hover:bg-white/[0.02]"
                      >
                        <td className="p-3 font-medium text-white">
                          {d.name}
                          {d.source === 'doc_os' ? (
                            <span className="ml-2 rounded bg-violet-500/10 px-1.5 py-0.5 type-caption uppercase text-violet-300">
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
            <p className="type-card-description text-[var(--ws-text-muted)]">
              {total} tenant-scoped document{total === 1 ? '' : 's'}
            </p>
          </>
        )}
      </div>

      {(detailLoading || selectedDocument) && (
        <div className="fixed inset-0 ac-layer-overlay flex justify-end bg-[var(--ws-canvas)]/70 backdrop-blur-sm" role="presentation" onClick={closeDocument}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Document details"
            onClick={(event) => event.stopPropagation()}
            className="h-full w-full max-w-2xl overflow-y-auto border-l border-[var(--ws-border)] bg-[var(--ws-canvas)] p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="type-caption font-black uppercase tracking-wider text-[var(--brand-blue-300)]">Document details</p>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  {selectedDocument?.document?.title || selectedDocument?.document?.name || 'Loading document…'}
                </h2>
              </div>
              <button type="button" onClick={closeDocument} className="min-h-11 min-w-11 rounded-lg border border-[var(--ws-border)] p-3 text-[var(--ws-text-secondary)]" aria-label="Close document details">
                <X className="h-4 w-4" />
              </button>
            </div>
            {detailLoading ? (
              <div className="mt-8 space-y-3">{[1,2,3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-white/5" />)}</div>
            ) : selectedDocument ? (
              <div className="mt-6 space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="ac-workspace-panel rounded-xl p-3"><p className="type-caption text-[var(--ws-text-muted)]">Status</p><p className="mt-1 font-semibold text-white">{selectedDocument.document?.status || '—'}</p></div>
                  <div className="ac-workspace-panel rounded-xl p-3"><p className="type-caption text-[var(--ws-text-muted)]">Approval</p><p className="mt-1 font-semibold text-white">{selectedDocument.document?.approval_status || 'Not requested'}</p></div>
                  <div className="ac-workspace-panel rounded-xl p-3"><p className="type-caption text-[var(--ws-text-muted)]">Signature</p><p className="mt-1 font-semibold text-white">{selectedDocument.document?.signature_status || 'Not requested'}</p></div>
                </div>
                <section className="ac-workspace-panel rounded-xl p-4">
                  <h3 className="font-semibold text-white">Document intelligence</h3>
                  <p className="mt-2 type-card-description text-[var(--ws-text-secondary)]">{selectedDocument.document?.summary || 'No summary has been generated yet.'}</p>
                  <div className="mt-4 space-y-2">
                    {(selectedDocument.findings || []).length ? (selectedDocument.findings || []).slice(0, 20).map((finding: any) => (
                      <div key={finding.id} className="rounded-lg border border-[var(--ws-border)] bg-white/[0.02] p-3">
                        <p className="type-ui font-semibold text-white">{finding.title || finding.finding_type || 'Finding'}</p>
                        <p className="mt-1 type-card-description text-[var(--ws-text-muted)]">{finding.summary || finding.description || finding.content || 'Review this finding in the document.'}</p>
                      </div>
                    )) : <p className="type-card-description text-[var(--ws-text-muted)]">No intelligence findings yet.</p>}
                  </div>
                </section>
                <section className="ac-workspace-panel rounded-xl p-4">
                  <h3 className="font-semibold text-white">Relationships</h3>
                  <p className="mt-2 type-card-description text-[var(--ws-text-muted)]">{(selectedDocument.relationships || []).length} linked client, project, contract, invoice, or other workspace record(s).</p>
                </section>
                <section className="ac-workspace-panel rounded-xl p-4">
                  <h3 className="font-semibold text-white">Recent activity</h3>
                  <div className="mt-3 space-y-2">
                    {(selectedDocument.activity || []).slice(0, 10).map((activity: any) => (
                      <div key={activity.id} className="flex items-start justify-between gap-3 border-b border-[var(--ws-border)] py-2 last:border-0">
                        <span className="type-card-description text-[var(--ws-text-secondary)]">{activity.action || 'Updated'}</span>
                        <span className="type-caption text-[var(--ws-text-muted)]">{activity.created_at ? new Date(activity.created_at).toLocaleString() : ''}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
