'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Loader2, Send, CheckCircle2 } from 'lucide-react';
import type { FormField } from '@/types/tenantForms';
import TurnstileWidget from '@/components/security/TurnstileWidget';

interface BrandedFormViewProps {
  tenant: { name: string; slug: string; logoUrl?: string | null; brandColor: string };
  form: { slug: string; title: string; description?: string | null; fields: FormField[]; settings?: Record<string, unknown> };
}

function buildSchema(fields: FormField[]) {
  const shape: Record<string, z.ZodTypeAny> = {
    _hp: z.string().optional(),
  };
  for (const field of fields) {
    let validator: z.ZodTypeAny = z.string();
    if (field.type === 'email') {
      validator = z.string().email('Enter a valid email');
    }
    if (field.required) {
      validator = validator.refine((v) => String(v || '').trim().length > 0, `${field.label} is required`);
    } else {
      validator = validator.optional().or(z.literal(''));
    }
    shape[field.id] = validator;
  }
  return z.object(shape);
}

export default function BrandedFormView({ tenant, form }: BrandedFormViewProps) {
  const accent = tenant.brandColor || '#14b8a6';
  const fields = form.fields || [];
  const schema = useMemo(() => buildSchema(fields), [fields]);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
    reset,
  } = useForm<Record<string, string>>({
    defaultValues: { _hp: '' },
  });

  const [done, setDone] = useState(false);
  const [thankYou, setThankYou] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileNonce, setTurnstileNonce] = useState(0);
  const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  const onSubmit = async (values: Record<string, string>) => {
    setError(null);
    setFieldErrors({});
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string') next[key] = issue.message;
      }
      setFieldErrors(next);
      return;
    }
    try {
      const { _hp, ...data } = parsed.data;
      const res = await fetch('/api/forms/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: tenant.slug,
          formSlug: form.slug,
          data,
          _hp,
          turnstileToken: turnstileToken || undefined,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || 'Submission failed');
      setThankYou(payload.thankYouMessage || 'Thank you!');
      setDone(true);
      setTurnstileToken('');
      setTurnstileNonce((value) => value + 1);
      reset();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setTurnstileToken('');
      setTurnstileNonce((value) => value + 1);
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

        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-3xl border border-slate-200 shadow-lg p-6 md:p-8 space-y-4">
          <input type="text" {...register('_hp')} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

          {fields.map((field) => (
            <div key={field.id} className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                {field.label}{field.required ? ' *' : ''}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  {...register(field.id)}
                  placeholder={field.placeholder}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 resize-y"
                />
              ) : field.type === 'select' ? (
                <select
                  {...register(field.id)}
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
                  {...register(field.id)}
                  placeholder={field.placeholder}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2"
                />
              )}
              {fieldErrors[field.id] && (
                <p className="text-xs text-red-600">{fieldErrors[field.id]}</p>
              )}
            </div>
          ))}

          {turnstileEnabled && (
            <TurnstileWidget
              key={turnstileNonce}
              className="flex justify-center"
              onTokenChange={setTurnstileToken}
              onExpire={() => setTurnstileToken('')}
              onError={() => setTurnstileToken('')}
            />
          )}

          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting || (turnstileEnabled && !turnstileToken)}
            className="w-full py-3.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-60 transition-transform active:scale-[0.98]"
            style={{ backgroundColor: accent }}
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {isSubmitting ? 'Sending...' : 'Submit'}
          </button>

          <p className="text-center text-[10px] text-slate-400 pt-1">Powered by AlphaClone</p>
        </form>
      </div>
    </div>
  );
}
