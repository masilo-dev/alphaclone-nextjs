import type { Metadata } from 'next';
import BrandedFormClient from './BrandedFormClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Contact Form | ${slug}`,
    robots: { index: false, follow: false },
  };
}

export default async function TenantDefaultFormPage({ params }: PageProps) {
  const { slug } = await params;
  return <BrandedFormClient tenantSlug={slug} formSlug="contact" />;
}
