import { notFound } from 'next/navigation';
import { createAdminSupabaseClientOrThrow } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export default async function TenantPolicyPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string; slug: string }>;
  searchParams: Promise<{ lang?: string; jurisdiction?: string }>;
}) {
  const { tenantId, slug } = await params;
  const { lang = 'en', jurisdiction = 'global' } = await searchParams;
  const admin = createAdminSupabaseClientOrThrow();
  const { data: policy } = await admin.from('legal_policies').select('id,title,tenant_brands(legal_company_name,trading_name)')
    .eq('tenant_id', tenantId).eq('slug', slug).maybeSingle();
  if (!policy) notFound();
  const { data: versions } = await admin.from('legal_policy_versions')
    .select('version_number,language,jurisdiction,effective_at,published_at,content,integrity_hash')
    .eq('tenant_id', tenantId).eq('policy_id', policy.id).eq('status', 'published')
    .order('published_at', { ascending: false });
  const version = versions?.find((item) => item.language === lang && item.jurisdiction === jurisdiction)
    || versions?.find((item) => item.language === lang && item.jurisdiction === 'global')
    || versions?.find((item) => item.language === 'en' && item.jurisdiction === jurisdiction)
    || versions?.find((item) => item.language === 'en' && item.jurisdiction === 'global')
    || versions?.[0];
  if (!version) notFound();
  const brand = Array.isArray(policy.tenant_brands) ? policy.tenant_brands[0] : policy.tenant_brands;
  return <main lang={version.language} className="min-h-screen bg-white px-5 py-12 text-slate-900">
    <article className="mx-auto max-w-3xl">
      <p className="text-sm font-medium text-teal-700">{brand?.trading_name || brand?.legal_company_name || 'Legal policy'}</p>
      <h1 className="mt-2 text-4xl font-semibold">{policy.title}</h1>
      <p className="mt-3 text-sm text-slate-500">Version {version.version_number} · Published {version.published_at ? new Date(version.published_at).toLocaleDateString(version.language) : '—'} · Language {version.language}</p>
      {version.language !== lang && <p role="status" className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">An approved {lang} version is unavailable. This approved fallback is in {version.language}.</p>}
      <div className="prose prose-slate mt-10 max-w-none whitespace-pre-wrap">{version.content}</div>
      <footer className="mt-12 border-t pt-5 text-xs text-slate-500">Integrity reference: {version.integrity_hash}</footer>
    </article>
  </main>;
}
