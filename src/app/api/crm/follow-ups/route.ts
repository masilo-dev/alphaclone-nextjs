import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { ACTIVE_DEAL_STAGES } from '@/lib/crmPipelineStages';

const querySchema = z.object({
  tenantId: z.string().uuid(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
});

type FollowUpItem = {
  id: string;
  entityType: 'deal' | 'lead' | 'contact' | 'company' | 'opportunity';
  title: string;
  subtitle?: string;
  reason: string;
  dueAt?: string | null;
  priority: 'low' | 'medium' | 'high';
  href: string;
};

export async function GET(req: NextRequest) {
  try {
    const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 422 });
    }

    const { tenantId, limit } = parsed.data;
    const { admin } = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'member', 'super_admin'], req);
    const now = new Date();
    const nowIso = now.toISOString();
    const staleIso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const items: FollowUpItem[] = [];

    const { data: dueContacts } = await admin
      .from('contacts')
      .select('id, first_name, last_name, email, next_followup_at')
      .eq('tenant_id', tenantId)
      .not('next_followup_at', 'is', null)
      .lte('next_followup_at', nowIso)
      .order('next_followup_at', { ascending: true })
      .limit(limit);

    for (const c of dueContacts || []) {
      items.push({
        id: c.id,
        entityType: 'contact',
        title: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || 'Contact',
        subtitle: c.email,
        reason: 'Scheduled follow-up due',
        dueAt: c.next_followup_at,
        priority: 'high',
        href: '/dashboard/contacts',
      });
    }

    const { data: dueCompanies } = await admin
      .from('companies')
      .select('id, name, next_followup_at')
      .eq('tenant_id', tenantId)
      .not('next_followup_at', 'is', null)
      .lte('next_followup_at', nowIso)
      .order('next_followup_at', { ascending: true })
      .limit(limit);

    for (const co of dueCompanies || []) {
      items.push({
        id: co.id,
        entityType: 'company',
        title: co.name,
        reason: 'Account follow-up due',
        dueAt: co.next_followup_at,
        priority: 'high',
        href: '/dashboard/crm/accounts',
      });
    }

    const { data: dueOpps } = await admin
      .from('opportunities')
      .select('id, name, stage, next_followup_at, amount')
      .eq('tenant_id', tenantId)
      .not('next_followup_at', 'is', null)
      .lte('next_followup_at', nowIso)
      .not('stage', 'in', '("closed_won","closed_lost")')
      .order('next_followup_at', { ascending: true })
      .limit(limit);

    for (const o of dueOpps || []) {
      items.push({
        id: o.id,
        entityType: 'opportunity',
        title: o.name,
        subtitle: o.stage,
        reason: 'Opportunity follow-up due',
        dueAt: o.next_followup_at,
        priority: 'high',
        href: '/dashboard/crm/accounts',
      });
    }

    const { data: staleDeals } = await admin
      .from('deals')
      .select('id, name, stage, value, updated_at')
      .eq('tenant_id', tenantId)
      .in('stage', ACTIVE_DEAL_STAGES as unknown as string[])
      .lt('updated_at', staleIso)
      .order('updated_at', { ascending: true })
      .limit(limit);

    for (const d of staleDeals || []) {
      items.push({
        id: d.id,
        entityType: 'deal',
        title: d.name,
        subtitle: d.stage,
        reason: 'No activity in 7+ days',
        dueAt: d.updated_at,
        priority: 'medium',
        href: '/dashboard/deals',
      });
    }

    const { data: staleLeads } = await admin
      .from('leads')
      .select('id, business_name, email, stage, updated_at')
      .eq('tenant_id', tenantId)
      .not('stage', 'in', '("closed","won","lost")')
      .lt('updated_at', staleIso)
      .order('updated_at', { ascending: true })
      .limit(limit);

    for (const l of staleLeads || []) {
      items.push({
        id: l.id,
        entityType: 'lead',
        title: l.business_name || l.email || 'Lead',
        subtitle: l.stage,
        reason: 'Stale lead — no touch in 7+ days',
        dueAt: l.updated_at,
        priority: 'medium',
        href: '/dashboard/leads',
      });
    }

    items.sort((a, b) => {
      const pri = { high: 0, medium: 1, low: 2 };
      const pd = pri[a.priority] - pri[b.priority];
      if (pd !== 0) return pd;
      return new Date(a.dueAt || 0).getTime() - new Date(b.dueAt || 0).getTime();
    });

    return NextResponse.json({
      success: true,
      items: items.slice(0, limit),
      counts: {
        total: items.length,
        high: items.filter((i) => i.priority === 'high').length,
        medium: items.filter((i) => i.priority === 'medium').length,
      },
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load follow-ups', req);
  }
}
