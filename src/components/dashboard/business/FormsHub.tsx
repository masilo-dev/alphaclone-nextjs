'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, Copy, ExternalLink, Loader2, Save, Trash2, GripVertical, Link2, FileText, CheckSquare,
  ClipboardList, TrendingUp, ToggleRight, BarChart3, Code2, Inbox, Settings2, ChevronRight, User, Mail, Phone
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ModuleStatCards, type ModuleStat } from '../common/ModuleStatCards';
import { EmptyState } from '@/components/ui/EmptyState';
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

function SortableFieldRow({
  field,
  idx,
  onUpdate,
  onRemove,
}: {
  field: FormField;
  idx: number;
  onUpdate: (idx: number, next: FormField) => void;
  onRemove: (idx: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="flex flex-wrap gap-2 items-start p-3 rounded-xl bg-slate-950 border border-slate-800">
      <button type="button" className="mt-2 shrink-0 cursor-grab text-slate-600" {...attributes} {...listeners}>
        <GripVertical className="w-4 h-4" />
      </button>
      <select
        value={field.type}
        onChange={(e) => onUpdate(idx, { ...field, type: e.target.value as FormFieldType })}
        className="rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-white"
      >
        {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <input
        value={field.label}
        onChange={(e) => onUpdate(idx, { ...field, label: e.target.value })}
        placeholder="Label"
        className="flex-1 min-w-[120px] rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-white"
      />
      <label className="flex items-center gap-1 text-xs text-slate-400">
        <input type="checkbox" checked={!!field.required} onChange={(e) => onUpdate(idx, { ...field, required: e.target.checked })} />
        Required
      </label>
      <button type="button" onClick={() => onRemove(idx)} className="p-1.5 text-slate-500 hover:text-red-400">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
      {field.type === 'select' && (
        <div className="w-full basis-full space-y-1 mt-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase">Dropdown options (one per line)</label>
          <textarea
            value={(field.options || []).join('\n')}
            onChange={(e) => {
              const options = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean);
              onUpdate(idx, { ...field, options });
            }}
            rows={3}
            placeholder={'Option 1\nOption 2'}
            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-white font-mono"
          />
        </div>
      )}
    </div>
  );
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
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [formProvider, setFormProvider] = useState<'native' | 'typeform' | 'tally'>('native');
  const [embedUrl, setEmbedUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [editorTab, setEditorTab] = useState<'fields' | 'embed' | 'external'>('fields');
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(true);
  const [viewMode, setViewMode] = useState<'editor' | 'submissions'>('editor');
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);

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

  const embedSnippet = useMemo(() => {
    if (!publicUrl) return '';
    return `<iframe src="${publicUrl}" width="100%" height="680" frameborder="0" style="border:0;border-radius:12px;" title="${title}"></iframe>`;
  }, [publicUrl, title]);

  const typeformWebhookUrl = useMemo(() => {
    if (!appOrigin || !tenantSlug) return '';
    return `${appOrigin}/api/forms/webhook/typeform?tenantSlug=${encodeURIComponent(tenantSlug)}&formSlug=${encodeURIComponent(slug)}`;
  }, [appOrigin, tenantSlug, slug]);

  const tallyWebhookUrl = useMemo(() => {
    if (!appOrigin || !tenantSlug) return '';
    return `${appOrigin}/api/forms/webhook/tally?tenantSlug=${encodeURIComponent(tenantSlug)}&formSlug=${encodeURIComponent(slug)}`;
  }, [appOrigin, tenantSlug, slug]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setFields((items) => {
      const oldIndex = items.findIndex((f) => f.id === active.id);
      const newIndex = items.findIndex((f) => f.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const applyFormSettings = (settings: Record<string, unknown>) => {
    setThankYou(String(settings.thankYouMessage || 'Thank you! We will be in touch soon.'));
    setNotifyEmail(settings.notifyEmail !== false);
    setFormProvider((settings.provider as 'native' | 'typeform' | 'tally') || 'native');
    setEmbedUrl(String(settings.embedUrl || ''));
    setWebhookSecret(String(settings.webhookSecret || ''));
  };

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
        applyFormSettings((pick.settings || {}) as Record<string, unknown>);
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

  const loadSubmissions = useCallback(async (formId: string) => {
    if (!currentTenant?.id || !formId) return;
    setSubmissionsLoading(true);
    try {
      const { data, error } = await supabase
        .from('form_submissions')
        .select('id, submitter_name, submitter_email, submitter_phone, data, status, source, created_at')
        .eq('form_id', formId)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setSubmissions(data || []);
    } catch (err: any) {
      toast.error('Failed to load submissions');
    } finally {
      setSubmissionsLoading(false);
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    if (viewMode === 'submissions' && selectedId) {
      loadSubmissions(selectedId);
    }
  }, [viewMode, selectedId, loadSubmissions]);

  const selectForm = (form: TenantForm) => {
    setSelectedId(form.id);
    setTitle(form.title);
    setDescription(form.description || '');
    setSlug(form.slug);
    setFields(form.fields?.length ? form.fields : DEFAULT_CONTACT_FIELDS);
    applyFormSettings((form.settings || {}) as Record<string, unknown>);
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
          settings: {
            thankYouMessage: thankYou,
            createLead: true,
            notifyEmail,
            provider: formProvider,
            embedUrl: embedUrl || undefined,
            webhookSecret: webhookSecret || undefined,
          },
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

      {forms.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No forms yet"
          description="Create your first branded form to capture leads on your domain — like a built-in OpnForm."
          actionLabel="Create first form"
          onAction={handleNewForm}
        />
      ) : (
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

          {/* Mode toggle */}
          <div className="flex gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setViewMode('editor')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'editor' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Settings2 className="w-3.5 h-3.5" /> Editor
            </button>
            <button
              type="button"
              onClick={() => setViewMode('submissions')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'submissions' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Inbox className="w-3.5 h-3.5" /> Submissions
              {(forms.find(f => f.id === selectedId)?.submission_count || 0) > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[10px]">
                  {forms.find(f => f.id === selectedId)?.submission_count}
                </span>
              )}
            </button>
          </div>

          {/* Submissions view */}
          {viewMode === 'submissions' && (
            <div className="space-y-3">
              {submissionsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
                </div>
              ) : submissions.length === 0 ? (
                <div className="text-center py-12">
                  <Inbox className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm font-medium">No submissions yet</p>
                  <p className="text-slate-500 text-xs mt-1">Share your form link to start collecting responses</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {submissions.map((sub) => (
                    <div key={sub.id} className="border border-slate-800 rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandedSub(expandedSub === sub.id ? null : sub.id)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-teal-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{sub.submitter_name || 'Anonymous'}</p>
                            <p className="text-xs text-slate-500 truncate">{sub.submitter_email || '—'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-2">
                          <span className="text-xs text-slate-500">{new Date(sub.created_at).toLocaleDateString()}</span>
                          <ChevronRight className={`w-4 h-4 text-slate-600 transition-transform ${expandedSub === sub.id ? 'rotate-90' : ''}`} />
                        </div>
                      </button>
                      {expandedSub === sub.id && (
                        <div className="px-4 pb-4 pt-1 space-y-2 border-t border-slate-800 bg-slate-950/40">
                          {sub.submitter_email && (
                            <div className="flex items-center gap-2 text-xs text-slate-300">
                              <Mail className="w-3.5 h-3.5 text-slate-500" />
                              <a href={`mailto:${sub.submitter_email}`} className="hover:text-teal-400 underline">{sub.submitter_email}</a>
                            </div>
                          )}
                          {sub.submitter_phone && (
                            <div className="flex items-center gap-2 text-xs text-slate-300">
                              <Phone className="w-3.5 h-3.5 text-slate-500" />
                              {sub.submitter_phone}
                            </div>
                          )}
                          {sub.data && typeof sub.data === 'object' && Object.entries(sub.data).filter(([k]) => !['name','email','phone','_hp'].includes(k)).map(([k, v]) => (
                            <div key={k} className="text-xs">
                              <span className="text-slate-500 capitalize">{k.replace(/_/g, ' ')}:</span>{' '}
                              <span className="text-slate-300">{String(v)}</span>
                            </div>
                          ))}
                          {sub.source && (
                            <div className="text-[10px] text-slate-600 mt-1">Source: {sub.source}</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {viewMode === 'editor' && <>
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

          <div className="flex gap-2 border-b border-slate-800 pb-2">
            {(['fields', 'embed', 'external'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setEditorTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize ${
                  editorTab === tab ? 'bg-teal-500/20 text-teal-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab === 'external' ? 'Typeform / Tally' : tab}
              </button>
            ))}
          </div>

          {editorTab === 'embed' && (
            <div className="space-y-2 p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-2 text-teal-400 text-xs font-bold"><Code2 className="w-4 h-4" /> Embed snippet</div>
              <textarea readOnly value={embedSnippet} rows={4} className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-2 text-[10px] text-slate-300 font-mono" />
              <button
                type="button"
                onClick={async () => { await navigator.clipboard.writeText(embedSnippet); toast.success('Embed code copied'); }}
                className="text-xs font-bold text-teal-400 hover:text-teal-300"
              >
                Copy iframe code
              </button>
            </div>
          )}

          {editorTab === 'external' && (
            <div className="space-y-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Provider</label>
              <select value={formProvider} onChange={(e) => setFormProvider(e.target.value as 'native' | 'typeform' | 'tally')} className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-2 text-white">
                <option value="native">Native AlphaClone form</option>
                <option value="typeform">Typeform embed + webhook</option>
                <option value="tally">Tally embed + webhook</option>
              </select>
              {(formProvider === 'typeform' || formProvider === 'tally') && (
                <>
                  <input value={embedUrl} onChange={(e) => setEmbedUrl(e.target.value)} placeholder="https://form.typeform.com/to/..." className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-2 text-white" />
                  <input value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} placeholder="Webhook secret (optional)" className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-2 text-white" />
                  <div className="space-y-1">
                    <p className="text-slate-500">Typeform webhook URL</p>
                    <code className="block text-[10px] text-slate-300 break-all">{typeformWebhookUrl}</code>
                    <p className="text-slate-500 pt-2">Tally webhook URL</p>
                    <code className="block text-[10px] text-slate-300 break-all">{tallyWebhookUrl}</code>
                  </div>
                </>
              )}
            </div>
          )}

          {editorTab === 'fields' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2"><FileText className="w-4 h-4 text-teal-400" /> Fields</h3>
              <button type="button" onClick={() => setFields((f) => [...f, newField()])} className="text-xs font-bold text-teal-400 hover:text-teal-300">+ Add field</button>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                {fields.map((field, idx) => (
                  <SortableFieldRow
                    key={field.id}
                    field={field}
                    idx={idx}
                    onUpdate={(i, next) => setFields((arr) => arr.map((f, j) => (j === i ? next : f)))}
                    onRemove={(i) => setFields((arr) => arr.filter((_, j) => j !== i))}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Thank-you message</label>
            <input value={thankYou} onChange={(e) => setThankYou(e.target.value)} className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white" />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />
            Email workspace admin on new submission
          </label>

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
          </>}
        </div>
      </div>
      )}
    </div>
  );
}
