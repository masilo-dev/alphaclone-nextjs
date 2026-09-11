import type { Metadata } from 'next';
import { buildPrivateMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPrivateMetadata(
  'Private documentation',
  'Internal AlphaClone documentation.',
);

export default function PrivateDocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
