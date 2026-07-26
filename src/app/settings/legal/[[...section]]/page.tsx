import { notFound } from 'next/navigation';
import { LegalGovernanceWorkspace } from '@/components/compliance/LegalGovernanceWorkspace';

const valid = new Set(['privacy','terms','cookies','email','data-processing','subprocessors','retention','consent','localisation']);

export default async function LegalSettingsPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section } = await params;
  if (section && (section.length !== 1 || !valid.has(section[0]))) notFound();
  return <LegalGovernanceWorkspace section={section?.[0] || 'overview'} />;
}
