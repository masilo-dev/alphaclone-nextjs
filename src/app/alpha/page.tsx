import type { Metadata } from 'next';
import AlphaConsole from '@/components/alpha/AlphaConsole';

export const metadata: Metadata = {
  title: 'Alpha Executive Console | AlphaClone Systems',
  description: 'Executive dashboard for AlphaClone Systems. Monitor platform health, compliance status, and business operations.',
  robots: { index: false, follow: false },
};

export default function AlphaExecutivePage() {
    return <AlphaConsole />;
}
