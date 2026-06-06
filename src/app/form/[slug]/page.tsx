import type { Metadata } from 'next';
import BrandedFormClient from './BrandedFormClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Contact Form',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TenantDefaultFormPage({ params }: PageProps) {
  const { slug } = await params;
  return <BrandedFormClient tenantSlug={slug} formSlug="contact" />;
}
