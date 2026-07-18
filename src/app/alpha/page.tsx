import type { Metadata } from 'next';
import AlphaConsole from '@/components/alpha/AlphaConsole';

export const metadata: Metadata = {
  title: 'Alpha Executive Console | AlphaClone Systems',
  description: 'Run and monitor tenant-isolated assisted business missions with durable execution history.',
  robots: { index: false, follow: false },
};

export default function AlphaExecutivePage() {
    return <AlphaConsole />;
}
