'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/contexts/TenantContext';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';

export default function BookingTab() {
  const { currentTenant } = useTenant();
  const { t } = useLanguage();
  const router = useRouter();
  const [bookings, setBookings] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const slug = currentTenant?.slug;
  const path = slug ? `/book/${encodeURIComponent(slug)}` : '';
  const enabled = currentTenant?.settings?.booking?.enabled === true;
  useEffect(() => {
    if (!currentTenant?.id) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(`/api/tenant/${currentTenant.id}/bookings`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Bookings could not be loaded');
        setBookings(result.bookings || []); setError(null);
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Bookings could not be loaded'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 30_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [currentTenant?.id]);
  return <div className="space-y-4 pb-24" data-module="booking">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{t('Bookings')}</h2><button className="min-h-11 rounded-lg border border-[var(--ws-border)] px-4" onClick={() => router.push('/dashboard/business/settings?tab=booking')}>{t('Booking settings')}</button></div>
    <section className="ac-workspace-panel space-y-3 rounded-xl p-4">
      <h3 className="font-semibold">{t('Your booking link')}</h3>
      <p className="text-[var(--ws-text-secondary)]">{t('Customers book directly with your business. Both you and the customer receive confirmation emails.')}</p>
      {path && <a href={path} target="_blank" rel="noreferrer" className="block break-all text-[var(--brand-blue-300)]">{typeof window !== 'undefined' ? window.location.origin : ''}{path}</a>}
      {path && <button className="min-h-11 rounded-lg bg-teal-600 px-4 text-white" onClick={() => { void navigator.clipboard.writeText(`${window.location.origin}${path}`).then(() => toast.success(t('Booking link copied'))).catch(() => toast.error(t('Could not copy booking link'))); }}>{t('Copy booking link')}</button>}
      {!enabled && <p>{t('Enable your booking page in Booking settings.')}</p>}
    </section>
    {error && <p role="alert">{error}</p>}
    {loading ? <p role="status">{t('Loading bookings…')}</p> : !bookings.length ? <p>{t('No bookings yet.')}</p> :
      <div className="space-y-2">{bookings.map(booking => <article key={booking.id} className="ac-workspace-panel rounded-xl p-3">
        <p className="font-semibold break-words">{booking.client_name}</p><p className="break-all text-[var(--ws-text-secondary)]">{booking.client_email}</p>
        <p>{new Date(booking.start_time).toLocaleString()}</p><p>{t(String(booking.status).replace(/_/g, ' '))}</p>
      </article>)}</div>}
  </div>;
}
