import { notFound, redirect } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { buildCanonicalProjectPortalUrl, resolveCanonicalProjectPortalToken, sanitizeProjectPortalRef } from '@/lib/projects/portalLinks';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tenantId?: string }>;
};

export default async function LegacyProjectLinkPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const safeRef = sanitizeProjectPortalRef(id);
  const tenantId = query?.tenantId && /^[0-9a-f-]{36}$/i.test(query.tenantId) ? query.tenantId : undefined;

  if (!safeRef) notFound();

  const token = await resolveCanonicalProjectPortalToken(createSupabaseAdminClient(), safeRef, tenantId);
  if (!token) notFound();

  redirect(buildCanonicalProjectPortalUrl(token));
}
