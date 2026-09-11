import { Suspense } from 'react';
import { PrivacyRequestStatus } from '@/components/compliance/PrivacyRequestStatus';

export default function PrivacyRequestStatusPage() {
  return <Suspense fallback={<main className="min-h-screen bg-slate-950 p-8 text-slate-100">Loading request…</main>}><PrivacyRequestStatus /></Suspense>;
}
