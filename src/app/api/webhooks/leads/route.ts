import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const leadSchema = z.object({
  id: z.string().trim().max(500).optional(),
  external_id: z.string().trim().max(500).optional(),
  business_name: z.string().trim().max(500).optional(),
  company: z.string().trim().max(500).optional(),
  name: z.string().trim().max(500).optional(),
  contact_name: z.string().trim().max(500).optional(),
  email: z.string().trim().email().max(320).optional().or(z.literal('')),
  phone: z.string().trim().max(100).optional().or(z.literal('')),
  website: z.string().trim().max(2000).optional().or(z.literal('')),
  industry: z.string().trim().max(200).optional(),
  location: z.string().trim().max(500).optional(),
  source: z.string().trim().max(120).optional(),
  status: z.string().trim().max(80).optional(),
  stage: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(5000).optional(),
  value: z.coerce.number().min(0).optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

const webhookPayloadSchema = z.object({
  tenantId: z.string().uuid(),
  leads: z.array(leadSchema).min(1).max(100).optional(),
}).and(leadSchema.partial());

type LeadInput = z.infer<typeof leadSchema>;

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function getBearerToken(req: NextRequest): string {
  return req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
}

function verifyWebhookSecret(req: NextRequest): boolean {
  const expected = process.env.LEAD_WEBHOOK_SECRET || process.env.INTERNAL_API_KEY;
  if (!expected) {
    console.error('[lead-webhook] LEAD_WEBHOOK_SECRET or INTERNAL_API_KEY is required');
    return false;
  }
  const provided = req.headers.get('x-lead-webhook-secret') || getBearerToken(req);
  return provided === expected;
}

function normalizeLead(input: LeadInput) {
  const businessName = input.business_name || input.company || input.name || input.email || input.phone;
  const externalId = input.external_id || input.id || null;
  return {
    business_name: businessName,
    contact_name: input.contact_name || null,
    email: input.email || null,
    phone: input.phone || null,
    website: input.website || null,
    industry: input.industry || null,
    location: input.location || null,
    source: input.source || 'lead_webhook',
    status: input.status || 'new',
    stage: input.stage || input.status || 'lead',
    notes: input.notes || null,
    value: input.value || 0,
    external_id: externalId,
    metadata: {
      ...input.metadata,
      webhook_source: input.source || 'lead_webhook',
      webhook_received_at: new Date().toISOString(),
    },
  };
}

export async function POST(req: NextRequest) {
  if (!verifyWebhookSecret(req)) return unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = webhookPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { tenantId } = parsed.data;
  const incoming: LeadInput[] = parsed.data.leads?.length
    ? parsed.data.leads
    : [leadSchema.parse(parsed.data)];
  const supabase = createSupabaseAdminClient();
  const results: Array<{
    id?: string;
    action: 'created' | 'updated' | 'skipped';
    error?: string;
    matched_existing?: boolean;
    match_reason?: string | null;
  }> = [];

  for (const rawLead of incoming) {
    const lead = normalizeLead(rawLead);
    if (!lead.business_name) {
      results.push({ action: 'skipped', error: 'Lead needs business_name, company, name, email, or phone' });
      continue;
    }

    try {
      const { resolveOrCreateCRMIdentity } = await import('@/lib/crm/resolveOrCreateCRMIdentity');
      const result = await resolveOrCreateCRMIdentity(
        {
          business_name: lead.business_name,
          contact_name: lead.contact_name,
          email: lead.email,
          phone: lead.phone,
          industry: lead.industry,
          location: lead.location,
          notes: lead.notes,
          external_id: lead.external_id,
          metadata: lead.metadata as Record<string, unknown>,
        },
        tenantId,
        lead.source || 'lead_webhook',
        { supabase },
      );
      results.push({
        id: result.lead_id,
        action: result.created ? 'created' : 'updated',
        matched_existing: result.matched_existing,
        match_reason: result.match_reason,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sync lead';
      results.push({ action: 'skipped', error: message });
    }
  }

  const created = results.filter((result) => result.action === 'created').length;
  const updated = results.filter((result) => result.action === 'updated').length;
  const skipped = results.filter((result) => result.action === 'skipped').length;

  return NextResponse.json({
    success: skipped === 0,
    created,
    updated,
    skipped,
    results,
  }, { status: skipped > 0 && created + updated === 0 ? 422 : 200 });
}
