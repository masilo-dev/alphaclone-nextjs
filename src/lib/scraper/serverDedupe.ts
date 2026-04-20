type LeadLike = {
  business_name?: string;
  website?: string;
  phone?: string;
  email?: string;
  lat?: number;
  lng?: number;
};

type SupabaseQueryClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => any;
    };
  };
};

function normalizeText(value: string | undefined): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeWebsiteHost(website: string | undefined): string {
  const raw = (website || '').trim();
  if (!raw) return '';
  try {
    const url = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return normalizeText(raw);
  }
}

function normalizePhone(phone: string | undefined): string {
  return (phone || '').replace(/\D/g, '');
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

function isDuplicateLead(current: LeadLike, historical: LeadLike): boolean {
  const currentName = normalizeText(current.business_name);
  const historicalName = normalizeText(historical.business_name);
  const currentHost = normalizeWebsiteHost(current.website);
  const historicalHost = normalizeWebsiteHost(historical.website);
  const currentPhone = normalizePhone(current.phone);
  const historicalPhone = normalizePhone(historical.phone);
  const currentEmail = normalizeText(current.email);
  const historicalEmail = normalizeText(historical.email);

  if (currentEmail && historicalEmail && currentEmail === historicalEmail) return true;
  if (currentPhone && historicalPhone && currentPhone === historicalPhone) return true;
  if (currentHost && historicalHost && currentHost === historicalHost) return true;

  if (currentName && historicalName && currentName === historicalName) {
    const cLat = toFiniteNumber(current.lat);
    const cLng = toFiniteNumber(current.lng);
    const hLat = toFiniteNumber(historical.lat);
    const hLng = toFiniteNumber(historical.lng);
    if (cLat !== null && cLng !== null && hLat !== null && hLng !== null) {
      return haversineKm(cLat, cLng, hLat, hLng) <= 3;
    }
    return true;
  }

  return false;
}

function parseLeadArray(value: unknown): LeadLike[] {
  return Array.isArray(value) ? (value as LeadLike[]) : [];
}

export async function dedupeLeadsAgainstTenantHistory(
  supabase: unknown,
  tenantId: string,
  leads: LeadLike[],
  currentJobId?: string
): Promise<{ deduped: LeadLike[]; removedCount: number }> {
  if (!tenantId || leads.length === 0) {
    return { deduped: leads, removedCount: 0 };
  }

  try {
    const queryClient = supabase as SupabaseQueryClient;
    const query = queryClient
      .from('lead_search_jobs')
      .select('id, final_results, partial_results, status, created_at')
      .eq('tenant_id', tenantId);
    const response = await query;
    const jobs = Array.isArray(response?.data) ? response.data : [];

    const historicalLeads: LeadLike[] = jobs
      .filter((job: any) => !currentJobId || String(job.id) !== currentJobId)
      .flatMap((job: any) => {
        const finalRows = parseLeadArray(job.final_results);
        if (finalRows.length > 0) return finalRows;
        return parseLeadArray(job.partial_results);
      });

    if (historicalLeads.length === 0) {
      return { deduped: leads, removedCount: 0 };
    }

    const deduped = leads.filter((lead) => !historicalLeads.some((hist) => isDuplicateLead(lead, hist)));
    return { deduped, removedCount: Math.max(0, leads.length - deduped.length) };
  } catch {
    return { deduped: leads, removedCount: 0 };
  }
}
