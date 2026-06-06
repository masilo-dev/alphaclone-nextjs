import BrandedFormClient from './BrandedFormClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TenantDefaultFormPage({ params }: PageProps) {
  const { slug } = await params;
  return <BrandedFormClient tenantSlug={slug} formSlug="contact" />;
}
