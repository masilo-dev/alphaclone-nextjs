'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Plus, Trash2, Loader2, Star, CheckCircle2, Edit2, Target, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

// ── Types ─────────────────────────────────────────────────

interface ICP {
  id: string;
  name: string;
  description?: string;
  is_default: boolean;
  industries?: string[];
  locations?: string[];
  company_size_min?: number;
  company_size_max?: number;
  job_titles?: string[];
  pain_points?: string[];
  technology_signals?: string[];
  website_required?: boolean;
  excluded_industries?: string[];
  created_at: string;
}

const EMPTY_FORM: Omit<ICP, 'id' | 'created_at'> = {
  name: '',
  description: '',
  is_default: false,
  industries: [],
  locations: [],
  company_size_min: undefined,
  company_size_max: undefined,
  job_titles: [],
  pain_points: [],
  technology_signals: [],
  website_required: false,
  excluded_industries: [],
};

// ── Tag input ─────────────────────────────────────────────

function TagInput({
  label, value, onChange, placeholder,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const tags = draft.split(',').map((s) => s.trim()).filter(Boolean);
    if (tags.length > 0) {
      onChange([...new Set([...value, ...tags])]);
      setDraft('');
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
          placeholder={placeholder || `Add ${label.toLowerCase()}…`}
          className="text-sm h-9 bg-white flex-1"
        />
        <Button type="button" size="sm" variant="outline" className="text-xs h-9" onClick={add}>Add</Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== tag))}
                className="hover:text-red-600 ml-0.5"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────

export default function ICPBuilder() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();

  const [icps, setIcps] = useState<ICP[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<ICP, 'id' | 'created_at'>>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const tenantId = currentTenant?.id;

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/outbound/icps?tenantId=${encodeURIComponent(tenantId)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setIcps(data.icps || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (icp: ICP) => {
    setEditingId(icp.id);
    setForm({
      name: icp.name,
      description: icp.description || '',
      is_default: icp.is_default,
      industries: icp.industries || [],
      locations: icp.locations || [],
      company_size_min: icp.company_size_min,
      company_size_max: icp.company_size_max,
      job_titles: icp.job_titles || [],
      pain_points: icp.pain_points || [],
      technology_signals: icp.technology_signals || [],
      website_required: icp.website_required ?? false,
      excluded_industries: icp.excluded_industries || [],
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const save = async () => {
    if (!tenantId || !form.name.trim()) return;
    setSaving(true);
    try {
      const url = '/api/outbound/icps';
      const isEdit = Boolean(editingId);
      const body = isEdit
        ? { tenantId, icpId: editingId, ...form }
        : { tenantId, ...form };

      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(isEdit ? 'ICP updated' : 'ICP created');
        resetForm();
        await load();
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || 'Failed to save ICP');
      }
    } catch {
      toast.error('Failed to save ICP');
    } finally {
      setSaving(false);
    }
  };

  const deleteICP = async (icpId: string) => {
    if (!tenantId || !confirm('Delete this ICP?')) return;
    try {
      const res = await fetch(
        `/api/outbound/icps?tenantId=${encodeURIComponent(tenantId)}&icpId=${encodeURIComponent(icpId)}`,
        { method: 'DELETE', credentials: 'include' }
      );
      if (res.ok) {
        toast.success('ICP deleted');
        await load();
      } else {
        toast.error('Failed to delete ICP');
      }
    } catch {
      toast.error('Failed to delete ICP');
    }
  };

  const setDefault = async (icpId: string) => {
    if (!tenantId) return;
    try {
      const res = await fetch('/api/outbound/icps', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, icpId, is_default: true }),
      });
      if (res.ok) {
        toast.success('Default ICP updated');
        await load();
      }
    } catch {
      toast.error('Failed to update default ICP');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Ideal Customer Profiles</h2>
          <p className="text-xs text-slate-500 mt-0.5">Define who you want to reach. Used by AI qualification.</p>
        </div>
        <Button
          size="sm"
          className="bg-[#356AF4] hover:bg-[#2a57d4] text-white text-xs"
          onClick={() => { resetForm(); setShowForm(true); }}
        >
          <Plus size={13} className="mr-1" /> New ICP
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800">
            {editingId ? 'Edit ICP' : 'Create ICP'}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Name *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Small Service Businesses"
                className="bg-white text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Description</label>
              <Input
                value={form.description || ''}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional notes"
                className="bg-white text-sm"
              />
            </div>
          </div>

          <TagInput
            label="Target industries"
            value={form.industries || []}
            onChange={(v) => setForm((f) => ({ ...f, industries: v }))}
            placeholder="e.g. SaaS, Consulting, Real Estate"
          />

          <TagInput
            label="Target locations"
            value={form.locations || []}
            onChange={(v) => setForm((f) => ({ ...f, locations: v }))}
            placeholder="e.g. United States, UK, Australia"
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Company size min</label>
              <Input
                type="number" min={1}
                value={form.company_size_min || ''}
                onChange={(e) => setForm((f) => ({ ...f, company_size_min: e.target.value ? Number(e.target.value) : undefined }))}
                placeholder="e.g. 1"
                className="bg-white text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Company size max</label>
              <Input
                type="number" min={1}
                value={form.company_size_max || ''}
                onChange={(e) => setForm((f) => ({ ...f, company_size_max: e.target.value ? Number(e.target.value) : undefined }))}
                placeholder="e.g. 50"
                className="bg-white text-sm"
              />
            </div>
          </div>

          <TagInput
            label="Target job titles"
            value={form.job_titles || []}
            onChange={(v) => setForm((f) => ({ ...f, job_titles: v }))}
            placeholder="e.g. CEO, Owner, Founder, Director"
          />

          <TagInput
            label="Pain points"
            value={form.pain_points || []}
            onChange={(v) => setForm((f) => ({ ...f, pain_points: v }))}
            placeholder="e.g. manual follow-up, no CRM, scattered invoicing"
          />

          <TagInput
            label="Technology signals"
            value={form.technology_signals || []}
            onChange={(v) => setForm((f) => ({ ...f, technology_signals: v }))}
            placeholder="e.g. Shopify, QuickBooks, WordPress"
          />

          <TagInput
            label="Excluded industries"
            value={form.excluded_industries || []}
            onChange={(v) => setForm((f) => ({ ...f, excluded_industries: v }))}
            placeholder="e.g. Gambling, Adult, MLM"
          />

          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.website_required || false}
                onChange={(e) => setForm((f) => ({ ...f, website_required: e.target.checked }))}
                className="rounded"
              />
              Website required
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
                className="rounded"
              />
              Set as default
            </label>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-[#356AF4] hover:bg-[#2a57d4] text-white text-xs"
              onClick={save}
              disabled={saving || !form.name.trim()}
            >
              {saving && <Loader2 size={13} className="animate-spin mr-1" />}
              {editingId ? 'Save changes' : 'Create ICP'}
            </Button>
            <Button size="sm" variant="outline" className="text-xs" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ICP list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : icps.length === 0 && !showForm ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 p-12 text-center">
          <Target size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">No ICPs yet</p>
          <p className="text-slate-400 text-xs mt-1">Create an ICP to enable AI lead qualification</p>
          <Button
            size="sm"
            className="mt-4 bg-[#356AF4] hover:bg-[#2a57d4] text-white text-xs"
            onClick={() => { resetForm(); setShowForm(true); }}
          >
            Create first ICP
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {icps.map((icp) => {
            const isExpanded = expandedId === icp.id;
            return (
              <div
                key={icp.id}
                className={cn(
                  'rounded-xl border bg-white shadow-sm overflow-hidden transition-all',
                  icp.is_default ? 'border-blue-200' : 'border-slate-200'
                )}
              >
                <div className="p-4 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={cn('mt-0.5 p-1.5 rounded-lg shrink-0', icp.is_default ? 'bg-blue-50' : 'bg-slate-50')}>
                      <Target size={13} className={icp.is_default ? 'text-blue-600' : 'text-slate-500'} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900 truncate">{icp.name}</p>
                        {icp.is_default && (
                          <Badge className="bg-blue-100 text-blue-700 text-xs">Default</Badge>
                        )}
                      </div>
                      {icp.description && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{icp.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(icp.industries || []).slice(0, 3).map((ind) => (
                          <span key={ind} className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{ind}</span>
                        ))}
                        {(icp.industries || []).length > 3 && (
                          <span className="text-xs text-slate-400">+{(icp.industries || []).length - 3} more</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {!icp.is_default && (
                      <button
                        onClick={() => setDefault(icp.id)}
                        title="Set as default"
                        className="p-1.5 text-slate-400 hover:text-amber-500 rounded-lg hover:bg-amber-50 transition-colors"
                      >
                        <Star size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(icp)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => deleteICP(icp.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : icp.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 space-y-2">
                    {icp.locations && icp.locations.length > 0 && (
                      <Row label="Locations" tags={icp.locations} />
                    )}
                    {icp.job_titles && icp.job_titles.length > 0 && (
                      <Row label="Job titles" tags={icp.job_titles} />
                    )}
                    {(icp.company_size_min !== undefined || icp.company_size_max !== undefined) && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500 w-24 shrink-0">Company size</span>
                        <span className="text-slate-700">{icp.company_size_min ?? '—'} – {icp.company_size_max ?? '—'} employees</span>
                      </div>
                    )}
                    {icp.pain_points && icp.pain_points.length > 0 && (
                      <Row label="Pain points" tags={icp.pain_points} />
                    )}
                    {icp.excluded_industries && icp.excluded_industries.length > 0 && (
                      <Row label="Excluded" tags={icp.excluded_industries} tagClass="bg-red-50 text-red-600 border-red-200" />
                    )}
                    {icp.website_required && (
                      <div className="flex items-center gap-2 text-xs">
                        <CheckCircle2 size={11} className="text-emerald-600" />
                        <span className="text-slate-600">Website required</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({ label, tags, tagClass }: { label: string; tags: string[]; tagClass?: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-slate-500 w-24 shrink-0 mt-0.5">{label}</span>
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <span key={tag} className={cn('text-xs px-1.5 py-0.5 rounded border', tagClass || 'bg-white text-slate-600 border-slate-200')}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
