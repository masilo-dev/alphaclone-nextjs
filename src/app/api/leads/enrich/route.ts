import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantRole } from '@/lib/apiAuth';
import { leadScoringService } from '@/services/enhancedLeadFinderServices';
import { z } from 'zod';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = String(body.tenantId || '').trim();
    const leadId = String(body.leadId || '').trim();

    if (!tenantId || !leadId || !z.string().uuid().safeParse(tenantId).success || !z.string().uuid().safeParse(leadId).success) {
      return NextResponse.json({ success: false, error: 'tenantId and leadId are required' }, { status: 400 });
    }

    const { admin } = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin'], req);

    const { data: lead, error } = await admin
      .from('leads')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', leadId)
      .single();

    if (error || !lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    const scored = await leadScoringService.scoreLead({
      email: lead.email,
      phone: lead.phone,
      rating: lead.rating,
      website: lead.website,
      business_name: lead.business_name,
      address: lead.location,
    });

    let nexusEnrichment: Record<string, unknown> | null = null;
    try {
      const { AlphaNexus } = await import('@/lib/social/alphaNexus');
      const nexus = new AlphaNexus(tenantId);
      nexusEnrichment = (await nexus.executeSystemAction('lead_enrichment', {
        lead_id: leadId,
      })) as Record<string, unknown>;
    } catch (nexusErr) {
      console.warn('[leads/enrich] nexus enrichment skipped:', nexusErr);
    }

    const verification = {
      score: scored.totalScore,
      tier: scored.tier,
      breakdown: scored.breakdown,
      verified_at: new Date().toISOString(),
      has_email: Boolean(lead.email),
      has_phone: Boolean(lead.phone),
      data_quality: scored.totalScore >= 70 ? 'verified' : scored.totalScore >= 40 ? 'partial' : 'unverified',
    };

    const metadata = {
      ...(lead.metadata || {}),
      verification,
    };

    await admin
      .from('leads')
      .update({ metadata, updated_at: new Date().toISOString() })
      .eq('id', leadId)
      .eq('tenant_id', tenantId);

    return NextResponse.json({ success: true, verification, leadId, nexus_enrichment: nexusEnrichment });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Enrichment failed' }, { status: 500 });
  }
}
