import type { Metadata } from 'next';
import WhoWeServeContent from './WhoWeServeContent';

export const metadata: Metadata = {
    title: 'Who We Serve | AlphaClone Business OS for Agencies, Startups & Remote Teams',
    description: 'AlphaClone serves growing agencies, SaaS startups, consulting firms, emerging market founders, privacy-first teams, and remote teams. See how we solve the challenges your business faces with one unified platform.',
    keywords: ['who AlphaClone serves', 'business OS for agencies', 'CRM for startups', 'consulting software', 'remote team tools', 'emerging market business software'],
    alternates: { canonical: 'https://alphaclone.tech/who-we-serve' },
    openGraph: {
        title: 'Who AlphaClone Serves | Business OS for Growing Teams',
        description: 'Agencies, startups, consultants, and remote teams — see why AlphaClone fits your business.',
        url: 'https://alphaclone.tech/who-we-serve',
        type: 'website',
    },
    robots: { index: true, follow: true },
};

export default function Page() {
    return <WhoWeServeContent />;
}
