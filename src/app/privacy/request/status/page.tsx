import { Suspense } from 'react';
import { PrivacyRequestStatus } from '@/components/compliance/PrivacyRequestStatus';

export default function PrivacyRequestStatusPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[var(--ws-canvas)] p-8 text-[var(--ws-text-primary)]">Loading request…</main>}><PrivacyRequestStatus /></Suspense>;
}
