import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PUBLIC_INTEGRATIONS } from '@/config/integrations';
import IntegrationDetailPage from '@/components/pages/IntegrationDetailPage';
import { SITE_URL } from '@/lib/siteUrl';

type PageProps = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return PUBLIC_INTEGRATIONS.map((integration) => ({ id: integration.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const integration = PUBLIC_INTEGRATIONS.find((item) => item.id === id);
  if (!integration) {
    return { title: 'Integration not found', robots: { index: false, follow: false } };
  }
  const canonical = `${SITE_URL}/ecosystem/${integration.id}`;
  const description = `${integration.description} Review ${integration.name} availability, supported workflow scope, approval boundaries, and connection details for AlphaClone.`;
  const title = `${integration.name} Integration | AlphaClone`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: 'website', images: [{ url: '/opengraph-image' }] },
    twitter: { card: 'summary_large_image', title, description, images: ['/twitter-image'] },
  };
}

export default async function IntegrationPage({ params }: PageProps) {
  const { id } = await params;
  const integration = PUBLIC_INTEGRATIONS.find((item) => item.id === id);
  if (!integration) notFound();
  return <IntegrationDetailPage integration={integration} />;
}
