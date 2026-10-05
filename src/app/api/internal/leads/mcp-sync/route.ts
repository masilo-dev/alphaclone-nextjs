import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { promoteToCanonicalLead } from '@/services/leads/canonicalLeadPromotion';

interface SyncLead {
  scraper_lead_id?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  business_name?: string;
  industry?: string;
  location?: string;
  source?: string;
  score?: number;
  grade?: string;
  notes?: string;
}

export async function POST(req: NextRequest) {
  const internalKey = req.headers.get('x-internal-api-key');
  if (!internalKey || internalKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { tenantId, userId, campaignId, leads } = body as {
      tenantId: string;
      userId: string;
      campaignId?: string;
      leads: SyncLead[];
    };

    if (!tenantId || !userId || !Array.isArray(leads)) {
      return NextResponse.json(
        { error: 'tenantId, userId, and leads array required' },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient();
    const created: Array<{ scraper_lead_id?: string; crm_lead_id?: string }> = [];

    for (const lead of leads) {
      let crmLeadId: string | undefined;

      if (lead.scraper_lead_id) {
        const { data: scraperRow } = await admin
          .from('scraper_leads')
          .select('*')
          .eq('id', lead.scraper_lead_id)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        const promotion = await promoteToCanonicalLead({
          admin,
          tenantId,
          ownerId: userId,
          source: {
            kind: 'scraper_lead',
            scraperLeadId: lead.scraper_lead_id,
            row: scraperRow || {
              id: lead.scraper_lead_id,
              business_name: lead.business_name,
              email: lead.email,
              phone: lead.phone,
              industry: lead.industry,
              location: lead.location,
              source: lead.source || 'scraper',
              notes: lead.notes,
              campaign_id: campaignId,
              contact_name: lead.contact_name,
            },
          },
          idempotencyKey: `scraper-promote:${tenantId}:${lead.scraper_lead_id}`,
          skipQualificationGate: true,
        });

        crmLeadId = String(promotion.lead.id || '');
        if (crmLeadId) {
          await admin
            .from('scraper_leads')
            .update({ crm_lead_id: crmLeadId, status: 'synced' })
            .eq('id', lead.scraper_lead_id)
            .eq('tenant_id', tenantId);
        }
      }

      created.push({
        scraper_lead_id: lead.scraper_lead_id,
        crm_lead_id: crmLeadId,
      });
    }

    return NextResponse.json({
      success: true,
      campaignId,
      created,
      count: created.filter((c) => c.crm_lead_id).length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'MCP sync failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
