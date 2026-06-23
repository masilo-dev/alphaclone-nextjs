import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/LegalPageShell';
import { CookiePolicyContent } from './shared';

export const metadata: Metadata = {
  title: 'Cookie Policy | AlphaClone Systems',
  description: 'Cookie policy for Alphaclone Systems, LLC.',
  alternates: { canonical: 'https://alphaclonesystems.com/legal/cookies' },
  robots: { index: true, follow: true },
};

export default function Page() {
  return (
    <LegalPageShell
      title="Cookie Policy"
      lastUpdated="June 9, 2025"
      intro="This policy explains what cookies are, which cookies AlphaClone uses, and how you can manage your preferences."
      sections={[
        { id: 'what-are-cookies', title: 'What cookies are' },
        { id: 'cookies-we-use', title: 'Cookies we use' },
        { id: 'controls', title: 'How to control them' },
        { id: 'table', title: 'Cookie table' },
        { id: 'contact', title: 'Contact' },
      ]}
      badge="Cookies"
    >
      <CookiePolicyContent />
    </LegalPageShell>
  );
}
