import type { Metadata } from 'next';
import DataDeletionPage from '@/components/pages/DataDeletionPage';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import { Trash2 } from 'lucide-react';

export const metadata: Metadata = {
    title: 'Data Deletion Request | AlphaClone Systems',
    description: 'Request deletion of your personal data from AlphaClone Systems. GDPR & CCPA compliant. Covers Facebook Login data, platform data, and all associated records.',
    robots: { index: true, follow: true },
    alternates: { canonical: 'https://alphaclonesystems.com/data-deletion' },
};

export default function Page() {
    return (
        <MarketingLandingShell>
            <div className="bg-slate-950 pt-20 text-white">
                <header className="border-b border-slate-800 bg-slate-900">
                    <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-8 sm:px-6 lg:px-8">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10" aria-hidden="true">
                            <Trash2 className="h-6 w-6 text-red-400" />
                        </span>
                        <div>
                            <h1 className="text-3xl font-bold text-white">Data Deletion Request</h1>
                            <p className="mt-1 text-base leading-6 text-slate-300">Request deletion of your AlphaClone account and associated personal data, or check an existing request.</p>
                        </div>
                    </div>
                </header>
                <DataDeletionPage />
            </div>
        </MarketingLandingShell>
    );
}
