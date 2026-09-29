import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse, createAdminSupabaseClientOrThrow } from '@/lib/apiAuth';
import { buildIlikeOrFilter } from '@/lib/db/postgrestFilters';

const contacted = ['sent', 'delivered', 'opened', 'clicked', 'replied', 'positive_reply', 'meeting_booked'];

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId') || '';
    await requireTenantAccess(tenantId, req);
    const source = req.nextUrl.searchParams.get('source') === 'clients' ? 'clients' : 'leads';
    const search = (req.nextUrl.searchParams.get('search') || '').trim().slice(0, 200);
    const page = Math.max(0, Math.min(1000, Number(req.nextUrl.searchParams.get('page') || 0) || 0));
    const selectedIds = (req.nextUrl.searchParams.get('ids') || '').split(',').filter(id => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 20);
    const admin = createAdminSupabaseClientOrThrow();
    const table = source === 'clients' ? 'business_clients' : 'leads';
    let query = admin.from(table).select('*');
    query = query.eq('tenant_id', tenantId);
    if (source === 'leads') query = query.neq('stage', 'converted');
    if (search) {
      const filter = buildIlikeOrFilter(source === 'clients' ? ['name', 'email', 'industry'] : ['business_name', 'email', 'industry'], search);
      if (filter) query = query.or(filter);
    }
    const { data, error } = await query.order('id').range(page * 100, page * 100 + 99);
    if (error) throw error;
    let rows = data || [];
    if (page === 0 && selectedIds.length) {
      const { data: selected, error: selectedError } = await admin.from(table).select('*')
        .eq('tenant_id', tenantId).in('id', selectedIds);
      if (selectedError) throw selectedError;
      const existing = new Set(rows.map(row => row.id));
      rows = [...(selected || []).filter(row => !existing.has(row.id)), ...rows];
    }
    const emails = [...new Set(rows.map((row) => String(row.email || '').trim().toLowerCase()).filter(Boolean))];
    const excluded = new Set<string>();
    if (emails.length) {
      const [logs, campaigns, suppressions] = await Promise.all([
        admin.from('lead_outreach_log').select('lead_email').eq('tenant_id', tenantId).in('status', contacted).in('lead_email', emails),
        admin.from('campaign_recipients').select('email').eq('tenant_id', tenantId).in('status', contacted).in('email', emails),
        admin.from('email_suppressions').select('email').eq('tenant_id', tenantId).in('email', emails),
      ]);
      for (const result of [logs, campaigns, suppressions]) {
        if (result.error) throw result.error;
        for (const item of result.data || []) excluded.add(String(('lead_email' in item ? item.lead_email : item.email) || '').toLowerCase());
      }
    }
    const seen = new Set<string>();
    const recipients = rows.filter((row) => {
      const email = String(row.email || '').trim().toLowerCase();
      if (!email || excluded.has(email) || seen.has(email)) return false;
      seen.add(email);
      return true;
    }).map((row) => ({
      id: row.id,
      businessName: 'name' in row ? row.name : row.business_name,
      email: row.email,
      industry: row.industry,
      phone: row.phone,
      website: row.website,
      location: row.location,
    }));
    return NextResponse.json({ recipients, hasMore: (data || []).length === 100 });
  } catch (error) {
    return routeErrorResponse(error, 'Recipients could not be loaded', req);
  }
}
