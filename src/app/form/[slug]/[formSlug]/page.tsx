import type { Metadata } from 'next';
import BrandedFormClient from '../BrandedFormClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string; formSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, formSlug } = await params;
  return {
    title: `${formSlug.charAt(0).toUpperCase() + formSlug.slice(1)} Form | ${slug}`,
    robots: { index: false, follow: false },
  };
}

export default async function TenantNamedFormPage({ params }: PageProps) {
  const { slug, formSlug } = await params;
  return <BrandedFormClient tenantSlug={slug} formSlug={formSlug} />;
}
