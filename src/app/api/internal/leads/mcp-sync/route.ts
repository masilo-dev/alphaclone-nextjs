import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { executeSingleBonnieTool } from '@/lib/bonnie/executeSingleBonnieTool';

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

    const supabase = createSupabaseAdminClient();
    const created: Array<{ scraper_lead_id?: string; crm_lead_id?: string }> = [];

    for (const lead of leads) {
      const result = await executeSingleBonnieTool({
        tenantId,
        userId,
        tool: 'create_lead',
        args: {
          contact_name: lead.contact_name,
          email: lead.email,
          phone: lead.phone,
          business_name: lead.business_name,
          industry: lead.industry,
          location: lead.location,
          source: lead.source || 'scraper',
          notes: lead.notes || `Score: ${lead.score ?? 'N/A'}, Grade: ${lead.grade ?? 'N/A'}`,
        },
        skipPolicy: true,
        policySource: 'mcp',
      });

      let crmLeadId: string | undefined;
      if (result.success && result.details) {
        try {
          const parsed = JSON.parse(result.details);
          crmLeadId = parsed.id || parsed.lead_id;
        } catch {
          const idMatch = result.details.match(/"id"\s*:\s*"([^"]+)"/);
          crmLeadId = idMatch?.[1];
        }
      }

      if (lead.scraper_lead_id && crmLeadId) {
        await supabase
          .from('scraper_leads')
          .update({ crm_lead_id: crmLeadId, status: 'synced' })
          .eq('id', lead.scraper_lead_id)
          .eq('tenant_id', tenantId);
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
