import type { Metadata } from 'next';
import { buildPrivateMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPrivateMetadata(
  'Book a meeting',
  'Schedule a meeting with AlphaClone Systems or use your business booking page.',
);

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
