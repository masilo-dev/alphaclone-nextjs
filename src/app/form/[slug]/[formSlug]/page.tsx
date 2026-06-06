import BrandedFormClient from '../BrandedFormClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string; formSlug: string }>;
}

export default async function TenantNamedFormPage({ params }: PageProps) {
  const { slug, formSlug } = await params;
  return <BrandedFormClient tenantSlug={slug} formSlug={formSlug} />;
}
