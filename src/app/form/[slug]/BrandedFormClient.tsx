'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import BrandedFormView from '@/components/forms/BrandedFormView';
import type { FormField } from '@/types/tenantForms';

export default function BrandedFormClient({
  tenantSlug,
  formSlug,
}: {
  tenantSlug: string;
  formSlug: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<{
    tenant: { name: string; slug: string; logoUrl?: string | null; brandColor: string };
    form: { slug: string; title: string; description?: string | null; fields: FormField[]; settings?: Record<string, unknown> };
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/forms/public?tenantSlug=${encodeURIComponent(tenantSlug)}&formSlug=${encodeURIComponent(formSlug)}`
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.error || 'Form not found');
        if (!cancelled) setPayload({ tenant: data.tenant, form: data.form });
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load form');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantSlug, formSlug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-red-600 font-semibold">{error || 'Form unavailable'}</p>
          <p className="text-slate-500 text-sm mt-2">Check the link or contact the business owner.</p>
        </div>
      </div>
    );
  }

  return <BrandedFormView tenant={payload.tenant} form={payload.form} />;
}
