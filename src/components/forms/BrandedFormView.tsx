'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Loader2, Send, CheckCircle2 } from 'lucide-react';
import type { FormField } from '@/types/tenantForms';

interface BrandedFormViewProps {
  tenant: { name: string; slug: string; logoUrl?: string | null; brandColor: string };
  form: { slug: string; title: string; description?: string | null; fields: FormField[]; settings?: Record<string, unknown> };
}

export default function BrandedFormView({ tenant, form }: BrandedFormViewProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [thankYou, setThankYou] = useState('');
  const [error, setError] = useState<string | null>(null);
  const accent = tenant.brandColor || '#14b8a6';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/forms/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: tenant.slug,
          formSlug: form.slug,
          data: values,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Submission failed');
      setThankYou(data.thankYouMessage || 'Thank you!');
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center bg-white rounded-3xl border border-slate-200 shadow-xl p-10">
          <CheckCircle2 className="w-14 h-14 mx-auto mb-4" style={{ color: accent }} />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Submitted</h1>
          <p className="text-slate-600">{thankYou}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-lg mx-auto px-6 py-12 md:py-16">
        <div className="text-center mb-8">
          {tenant.logoUrl ? (
            <div className="w-20 h-20 mx-auto rounded-2xl overflow-hidden relative border border-slate-200 shadow-md mb-4">
              <Image src={tenant.logoUrl} alt={tenant.name} fill className="object-cover" sizes="80px" />
            </div>
          ) : (
            <div
              className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-md mb-4"
              style={{ backgroundColor: accent }}
            >
              {tenant.name.charAt(0)}
            </div>
          )}
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">{tenant.name}</p>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{form.title}</h1>
          {form.description && <p className="text-slate-600 mt-2 text-sm leading-relaxed">{form.description}</p>}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 shadow-lg p-6 md:p-8 space-y-4">
          {(form.fields || []).map((field) => (
            <div key={field.id} className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                {field.label}{field.required ? ' *' : ''}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  value={values[field.id] || ''}
                  onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
                  placeholder={field.placeholder}
                  required={field.required}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 resize-y"
                  style={{ ['--tw-ring-color' as string]: accent }}
                />
              ) : field.type === 'select' ? (
                <select
                  value={values[field.id] || ''}
                  onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
                  required={field.required}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white outline-none"
                >
                  <option value="">Select...</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                  value={values[field.id] || ''}
                  onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
                  placeholder={field.placeholder}
                  required={field.required}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2"
                />
              )}
            </div>
          ))}

          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-60 transition-transform active:scale-[0.98]"
            style={{ backgroundColor: accent }}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting ? 'Sending...' : 'Submit'}
          </button>

          <p className="text-center text-[10px] text-slate-400 pt-1">Powered by AlphaClone</p>
        </form>
      </div>
    </div>
  );
}
