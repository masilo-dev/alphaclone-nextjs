import type { Metadata } from 'next';
import { buildPrivateMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPrivateMetadata(
  'Billing',
  'Manage your AlphaClone subscription and usage.',
);

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
