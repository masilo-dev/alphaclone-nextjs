import { Suspense } from 'react';
import { PreferenceCentre } from '@/components/compliance/PreferenceCentre';

export default function PreferenceCentrePage() {
  return <Suspense fallback={<main className="min-h-screen bg-[var(--ws-canvas)] p-8 text-[var(--ws-text-primary)]">Loading preferences…</main>}><PreferenceCentre /></Suspense>;
}
