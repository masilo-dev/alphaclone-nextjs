import type { Metadata } from 'next';
import { buildPrivateMetadata } from '@/lib/seo/metadata';

import '@/styles/alphaclone-os-v3.css';
import '@/styles/alphaclone-os-v3-pwa.css';
import '@/styles/apple-fluid-system.css';
import '@/styles/crisp-product-ui.css';

export const metadata: Metadata = buildPrivateMetadata(
  'Billing',
  'Manage your AlphaClone subscription and usage.',
);

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
