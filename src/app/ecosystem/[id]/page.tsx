import { notFound } from 'next/navigation';
import { PUBLIC_INTEGRATIONS } from '@/config/integrations';
import IntegrationDetailPage from '@/components/pages/IntegrationDetailPage';

export function generateStaticParams() {
  return PUBLIC_INTEGRATIONS.map((integration) => ({ id: integration.id }));
}

export default async function IntegrationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const integration = PUBLIC_INTEGRATIONS.find((item) => item.id === id);
  if (!integration) notFound();
  return <IntegrationDetailPage integration={integration} />;
}
