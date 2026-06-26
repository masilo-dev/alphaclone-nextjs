'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus, Loader2, ChevronRight } from 'lucide-react';
import { companyService, type Company } from '@/services/unified/CompanyService';
import ListViewToolbar from './ListViewToolbar';
import RecordPageShell from './RecordPageShell';
import RecordFilesTab from './RecordFilesTab';
import EmptyState from '@/components/ui/EmptyState';
import toast from 'react-hot-toast';

const STAGE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'lead', label: 'Lead' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'customer', label: 'Customer' },
  { value: 'churned', label: 'Churned' },
];

export default function AccountsPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [selected, setSelected] = useState<Company | null>(null);
  const [detailTab, setDetailTab] = useState('overview');
  const [relations, setRelations] = useState<{ contacts: unknown[]; opportunities: unknown[]; activities: unknown[] } | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await companyService.list({
        search: search || undefined,
        lifecycle_stage: stageFilter !== 'all' ? stageFilter : undefined,
        limit: 100,
      });
      setCompanies(data as Company[]);
    } catch (e) {
      toast.error('Failed to load accounts');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, stageFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreateAccount = async () => {
    const name = window.prompt('Company / account name');
    if (!name?.trim()) return;
    setCreating(true);
    try {
      const company = await companyService.create({
        name: name.trim(),
        lifecycle_stage: 'lead',
      });
      setCompanies((prev) => [company, ...prev]);
      toast.success('Account created');
    } catch {
      toast.error('Failed to create account');
    } finally {
      setCreating(false);
    }
  };

  const handleEditAccount = async () => {
    if (!selected) return;
    const name = window.prompt('Account name', selected.name);
    if (!name?.trim() || name.trim() === selected.name) return;
    try {
      const updated = await companyService.update(selected.id, { name: name.trim() });
      setSelected(updated);
      setCompanies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      toast.success('Account updated');
    } catch {
      toast.error('Failed to update account');
    }
  };

  const openDetail = async (company: Company) => {
    setSelected(company);
    setDetailTab('overview');
    try {
      const rel = await companyService.getWithRelations(company.id);
      setRelations({
        contacts: rel.contacts || [],
        opportunities: rel.opportunities || [],
        activities: rel.activities || [],
      });
    } catch {
      setRelations({ contacts: [], opportunities: [], activities: [] });
    }
  };

  if (selected) {
    return (
      <RecordPageShell
        icon={Building2}
        name={selected.name}
        subtitle={selected.industry || selected.domain || 'Account'}
        badges={[
          { label: selected.lifecycle_stage, className: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
          ...(selected.health_score ? [{ label: `Health ${selected.health_score}` }] : []),
        ]}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'contacts', label: 'Contacts' },
          { id: 'deals', label: 'Opportunities' },
          { id: 'files', label: 'Files' },
          { id: 'activity', label: 'Activity' },
        ]}
        activeTab={detailTab}
        onTabChange={setDetailTab}
        onEdit={handleEditAccount}
      >
        <div className="p-4 space-y-4">
          {detailTab === 'overview' && (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Website', selected.website || '—'],
                ['Industry', selected.industry || '—'],
                ['Employees', selected.employee_count?.toString() || '—'],
                ['Revenue', selected.annual_revenue ? `$${selected.annual_revenue.toLocaleString()}` : '—'],
              ].map(([k, v]) => (
                <div key={k} className="bg-slate-900 border border-white/5 rounded-xl p-3">
                  <dt className="text-xs text-slate-500">{k}</dt>
                  <dd className="text-white font-medium mt-0.5">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {detailTab === 'contacts' && (
            <RelatedList items={relations?.contacts || []} labelKey="email" fallback="Contact" />
          )}
          {detailTab === 'deals' && (
            <RelatedList items={relations?.opportunities || []} labelKey="name" fallback="Opportunity" />
          )}
          {detailTab === 'files' && <RecordFilesTab companyId={selected.id} />}
          {detailTab === 'activity' && (
            <RelatedList items={relations?.activities || []} labelKey="subject" fallback="Activity" />
          )}
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-sm text-teal-400 font-bold hover:text-teal-300"
          >
            ← Back to accounts
          </button>
        </div>
      </RecordPageShell>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto pb-24">
      <ListViewToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search accounts..."
        filters={STAGE_FILTERS}
        activeFilter={stageFilter}
        onFilterChange={setStageFilter}
        actions={
          <button
            type="button"
            disabled={creating}
            onClick={handleCreateAccount}
            className="h-10 px-3 rounded-xl bg-teal-500 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> New
          </button>
        }
      />
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
        </div>
      ) : companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No accounts yet"
          description="Create your first company account to organize contacts and deals by organization."
          actionLabel="Open CRM workspace"
          onAction={() => router.push('/dashboard/crm/workspace')}
        />
      ) : (
        <div className="bg-slate-900 border border-white/5 rounded-2xl divide-y divide-white/5">
          {companies.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => openDetail(c)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-teal-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate">{c.name}</div>
                <div className="text-xs text-slate-500 capitalize">{c.lifecycle_stage} · Health {c.health_score}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RelatedList({ items, labelKey, fallback }: { items: unknown[]; labelKey: string; fallback: string }) {
  if (!items.length) {
    return <p className="text-sm text-slate-500 py-8 text-center">No {fallback.toLowerCase()}s linked yet.</p>;
  }
  return (
    <div className="divide-y divide-white/5 bg-slate-900 border border-white/5 rounded-xl overflow-hidden">
      {items.map((item, i) => {
        const row = item as Record<string, unknown>;
        return (
          <div key={String(row.id ?? i)} className="px-4 py-3 text-sm text-white">
            {String(row[labelKey] ?? row.name ?? fallback)}
          </div>
        );
      })}
    </div>
  );
}
