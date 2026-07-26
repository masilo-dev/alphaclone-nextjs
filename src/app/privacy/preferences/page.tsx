import { Suspense } from 'react';
import { PreferenceCentre } from '@/components/compliance/PreferenceCentre';

export default function PreferenceCentrePage() {
  return <Suspense fallback={<main className="min-h-screen bg-slate-950 p-8 text-slate-100">Loading preferences…</main>}><PreferenceCentre /></Suspense>;
}
