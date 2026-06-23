'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, Copy, ExternalLink, Loader2, Save, Trash2, GripVertical, Link2, FileText, CheckSquare,
  ClipboardList, TrendingUp, ToggleRight, BarChart3
} from 'lucide-react';
import { ModuleStatCards, type ModuleStat } from '../common/ModuleStatCards';
import { useTenant } from '@/contexts/TenantContext';
import toast from 'react-hot-toast';
import type { FormField, FormFieldType, TenantForm } from '@/types/tenantForms';
import { DEFAULT_CONTACT_FIELDS } from '@/types/tenantForms';

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Dropdown' },
];

function newField(): FormField {
  const id = `field_${Date.now().toString(36)}`;
  return { id, type: 'text', label: 'New field', required: false, placeholder: '' };
}

export default function FormsHub() {
  const { currentTenant } = useTenant();
  const [forms, setForms] = useState<TenantForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [title, setTitle] = useState('Contact Us');
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('contact');
  const [fields, setFields] = useState<FormField[]>(DEFAULT_CONTACT_FIELDS);
  const [thankYou, setThankYou] = useState('Thank you! We will be in touch soon.');
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(true);

  const appOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const tenantSlug = currentTenant?.slug || '';

  const publicUrl = useMemo(() => {
    if (!tenantSlug) return '';
    if (isDefault || slug === 'contact') return `${appOrigin}/form/${tenantSlug}`;
    return `${appOrigin}/form/${tenantSlug}/${slug}`;
  }, [appOrigin, tenantSlug, slug, isDefault]);

  const submitEndpointUrl = useMemo(() => {
    if (!appOrigin) return '';
    return `${appOrigin}/api/forms/submit`;
  }, [appOrigin]);

  const loadForms = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    try {
      await fetch('/api/forms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: currentTenant.id }),
      });
      const res = await fetch(`/api/forms?tenantId=${encodeURIComponent(currentTenant.id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load forms');
      const list = (data.forms || []) as TenantForm[];
      setForms(list);
      const pick = list.find((f) => f.is_default) || list[0];
      if (pick) {
        setSelectedId(pick.id);
        setTitle(pick.title);
        setDescription(pick.description || '');
        setSlug(pick.slug);
        setFields(pick.fields?.length ? pick.fields : DEFAULT_CONTACT_FIELDS);
        setThankYou(String((pick.settings as any)?.thankYouMessage || thankYou));
        setIsActive(pick.is_active);
        setIsDefault(pick.is_default);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load forms');
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id]);

  useEffect(() => { loadForms(); }, [loadForms]);

  const selectForm = (form: TenantForm) => {
    setSelectedId(form.id);
    setTitle(form.title);
    setDescription(form.description || '');
    setSlug(form.slug);
    setFields(form.fields?.length ? form.fields : DEFAULT_CONTACT_FIELDS);
    setThankYou(String((form.settings as any)?.thankYouMessage || 'Thank you! We will be in touch soon.'));
    setIsActive(form.is_active);
    setIsDefault(form.is_default);
  };

  const handleSave = async () => {
    if (!currentTenant?.id) return;
    setSaving(true);
    try {
      const normalizedSlug = slug.trim().toLowerCase();
      const conflictingForm = forms.find((f) => f.slug === normalizedSlug && f.id !== selectedId);
      if (conflictingForm) {
        toast.error(`Slug "${normalizedSlug}" is already in use by "${conflictingForm.title}"`);
        return;
      }

      const nextIsDefault = isDefault;
      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          id: selectedId || undefined,
          slug: normalizedSlug,
          title,
          description,
          fields,
          is_active: isActive,
          is_default: nextIsDefault,
          settings: { thankYouMessage: thankYou, createLead: true },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success('Form saved');
      await loadForms();
      if (data.form?.id) setSelectedId(data.form.id);
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleNewForm = () => {
      setSelectedId(null);
      setTitle('New Form');
      setDescription('');
      setSlug(`form-${Date.now().toString(36).slice(-4)}`);
      setFields(DEFAULT_CONTACT_FIELDS);
      setIsActive(true);
      setIsDefault(false);
    };

  const copyLink = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    toast.success('Form link copied');
  };

  const copySubmitEndpoint = async () => {
    if (!submitEndpointUrl) return;
    await navigator.clipboard.writeText(submitEndpointUrl);
    toast.success('Submit endpoint copied');
  };

  const formStats = useMemo<ModuleStat[]>(() => {
    const totalSubmissions = forms.reduce((s, f) => s + (f.submission_count || 0), 0);
    const activeForms = forms.filter(f => f.is_active !== false).length;
    const avgPerForm = forms.length > 0 ? Math.round(totalSubmissions / forms.length) : 0;
    const defaultForm = forms.find(f => f.is_default);
    return [
      { label: 'Total Forms', value: forms.length, sub: `${activeForms} active`, Icon: ClipboardList, accent: 'teal' },
      { label: 'Submissions', value: totalSubmissions.toLocaleString(), sub: 'All-time captured', Icon: BarChart3, accent: 'blue' },
      { label: 'Avg / Form', value: avgPerForm, sub: 'Conversion volume', Icon: TrendingUp, accent: 'purple' },
      { label: 'Default Form', value: defaultForm ? 'Live' : 'None', sub: defaultForm?.slug || 'Set a default', Icon: ToggleRight, accent: defaultForm ? 'emerald' : 'amber' },
    ];
  }, [forms]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Branded Forms</h1>
          <p className="text-sm text-slate-400 mt-1">Native forms on your domain — like OpnForm, built into AlphaClone.</p>
        </div>
        <button
          onClick={handleNewForm}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold"
        >
          <Plus className="w-4 h-4" /> New form
        </button>
      </div>

      {forms.length > 0 && <ModuleStatCards stats={formStats} />}

      <div className="grid lg:grid-cols-[240px_1fr] gap-6">
        <div className="space-y-2">
          {forms.map((f) => (
            <button
              key={f.id}
              onClick={() => selectForm(f)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                selectedId === f.id
                  ? 'bg-teal-500/15 border-teal-500/40 text-white'
                  : 'bg-slate-900/50 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="font-bold text-sm truncate">{f.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">{f.submission_count || 0} submissions</div>
            </button>
          ))}
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 md:p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <Link2 className="w-4 h-4 text-teal-400 shrink-0" />
            <code className="text-xs text-slate-300 truncate flex-1">{publicUrl || 'Set workspace slug in settings'}</code>
            <button onClick={copyLink} className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white" title="Copy link">
              <Copy className="w-4 h-4" />
            </button>
            {publicUrl && (
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white" title="Preview">
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <CheckSquare className="w-4 h-4 text-teal-400 shrink-0" />
            <code className="text-xs text-slate-300 truncate flex-1">{submitEndpointUrl || '/api/forms/submit'}</code>
            <button onClick={copySubmitEndpoint} className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white" title="Copy submit endpoint">
              <Copy className="w-4 h-4" />
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Form title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">URL slug</label>
              <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white font-mono" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white resize-none" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2"><FileText className="w-4 h-4 text-teal-400" /> Fields</h3>
              <button onClick={() => setFields((f) => [...f, newField()])} className="text-xs font-bold text-teal-400 hover:text-teal-300">+ Add field</button>
            </div>
            {fields.map((field, idx) => (
              <div key={field.id} className="flex flex-wrap gap-2 items-start p-3 rounded-xl bg-slate-950 border border-slate-800">
                <GripVertical className="w-4 h-4 text-slate-600 mt-2 shrink-0" />
                <select
                  value={field.type}
                  onChange={(e) => setFields((arr) => arr.map((f, i) => i === idx ? { ...f, type: e.target.value as FormFieldType } : f))}
                  className="rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-white"
                >
                  {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input
                  value={field.label}
                  onChange={(e) => setFields((arr) => arr.map((f, i) => i === idx ? { ...f, label: e.target.value } : f))}
                  placeholder="Label"
                  className="flex-1 min-w-[120px] rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-white"
                />
                <label className="flex items-center gap-1 text-xs text-slate-400">
                  <input type="checkbox" checked={!!field.required} onChange={(e) => setFields((arr) => arr.map((f, i) => i === idx ? { ...f, required: e.target.checked } : f))} />
                  Required
                </label>
                <button onClick={() => setFields((arr) => arr.filter((_, i) => i !== idx))} className="p-1.5 text-slate-500 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Thank-you message</label>
            <input value={thankYou} onChange={(e) => setThankYou(e.target.value)} className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white" />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Form is live (public link works)
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Set as default contact form
          </label>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save form
          </button>
        </div>
      </div>
    </div>
  );
}
