export type LinkedInCompanyPage = {
  id: string;
  name: string | null;
  vanityName: string | null;
  logoUrl: string | null;
  roles?: string[];
  primaryRole?: string | null;
};

export function normalizeLinkedInScopes(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .flatMap((value) => String(value).split(/[,\s]+/))
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[,\s]+/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

export function extractLinkedInCompanyPages(raw: unknown): LinkedInCompanyPage[] {
  if (!raw || typeof raw !== 'object') return [];
  const maybePages = (raw as { company_pages?: unknown }).company_pages;
  if (!Array.isArray(maybePages)) return [];

  return maybePages
    .map<LinkedInCompanyPage | null>((page) => {
      if (!page || typeof page !== 'object') return null;
      const obj = page as Record<string, unknown>;
      const id = typeof obj.id === 'string' ? obj.id.trim() : '';
      if (!id) return null;
      return {
        id,
        name: typeof obj.name === 'string' ? obj.name : null,
        vanityName: typeof obj.vanityName === 'string' ? obj.vanityName : null,
        logoUrl: typeof obj.logoUrl === 'string' ? obj.logoUrl : null,
        roles: Array.isArray(obj.roles) ? obj.roles.map((role) => String(role)) : [],
        primaryRole: typeof obj.primaryRole === 'string' ? obj.primaryRole : null,
      } satisfies LinkedInCompanyPage;
    })
    .filter((page): page is LinkedInCompanyPage => !!page);
}
