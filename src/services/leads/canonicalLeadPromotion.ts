/**
 * Single canonical handoff from acquisition staging (lead_candidates, scraper_leads)
 * into CRM `leads`. Finder/scraper/MCP/UI must use this service.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { buildCanonicalBusinessKey } from '@/lib/lead-finder/core';
import { buildLeadQualification } from '@/lib/lead-finder/qualificationEngine';
import { executeMcpWrite } from '@/lib/mcp/executionGateway';
import { recordTenantEvent } from '@/lib/events/tenantEventLogger';

export type LeadPromotionSource =
  | { kind: 'lead_candidate'; candidateId: string; candidate: Record<string, unknown> }
  | { kind: 'scraper_lead'; scraperLeadId: string; row: Record<string, unknown> };

export type PromoteLeadResult = {
  lead: Record<string, unknown>;
  created: boolean;
  duplicate: boolean;
  promotion_id: string;
};

function buildLeadPayloadFromCandidate(
  c: Record<string, unknown>,
  tenantId: string,
  ownerId: string,
  sourceLabel: string
): Record<string, unknown> {
  const email =
    String(c.public_email || c.email || (c.raw_data as Record<string, unknown> | null)?.email || '').trim() ||
    null;
  const phone =
    String(c.public_phone || c.phone || (c.raw_data as Record<string, unknown> | null)?.phone || '').trim() ||
    null;
  const businessName = String(c.business_name || c.company || c.name || '').trim() || null;
  const website = String(c.website || (c.raw_data as Record<string, unknown> | null)?.website || '').trim() || null;
  const qualityScore = typeof c.quality_score === 'number' ? c.quality_score : 0;
  const fitScore = typeof c.fit_score === 'number' ? c.fit_score : 0;
  const confidence = typeof c.confidence_score === 'number' ? c.confidence_score : 0;
  const totalScore = Math.round(qualityScore * 0.5 + fitScore * 0.35 + confidence * 0.15);
  const stage =
    totalScore >= 75 ? 'qualified' : totalScore >= 50 ? 'prospect' : totalScore >= 25 ? 'lead' : 'lead';

  const notesParts: string[] = [];
  if (c.description) notesParts.push(String(c.description));
  if (typeof c.score_explanation === 'string' && c.score_explanation) {
    notesParts.push(`Fit: ${c.score_explanation}`);
  }
  if (c.city || c.country || c.industry) {
    const meta = [c.city, c.country].filter(Boolean).join(', ');
    if (meta || c.industry) notesParts.push([c.industry, meta].filter(Boolean).join(' · '));
  }
  if (c.source_url || c.source_type) {
    const srcParts = [c.source_type && `Source: ${c.source_type}`, c.source_url && String(c.source_url)].filter(
      Boolean
    );
    if (srcParts.length) notesParts.push(srcParts.join(' — '));
  }

  const canonicalKey = String(
    c.canonical_business_key ||
      buildCanonicalBusinessKey({
        email,
        phone,
        website,
        sourceExternalId: c.source_external_id ? String(c.source_external_id) : null,
        businessName: businessName || 'Discovered business',
        city: c.city ? String(c.city) : null,
        country: c.country ? String(c.country) : null,
      })
  );

  return {
    tenant_id: tenantId,
    owner_id: ownerId,
    business_name: businessName || 'Discovered business',
    industry: c.industry ? String(c.industry) : null,
    location: [c.city, c.country].filter(Boolean).join(', ') || null,
    phone,
    email,
    website,
    canonical_business_key: canonicalKey,
    source: sourceLabel,
    stage,
    value: 0,
    notes: notesParts.length ? notesParts.join('\n\n') : null,
    outreach_status: 'pending',
    is_verified: c.verification_status === 'verified',
    trust_score: Math.max(0, Math.min(100, totalScore)),
    verification_notes: c.verification_status
      ? `Lead Finder verification: ${String(c.verification_status)}`
      : null,
    metadata: {
      promotion_source_kind: c._promotion_kind || 'lead_candidate',
      lead_candidate_id: c.id ? String(c.id) : null,
      scraper_lead_id: c.scraper_lead_id ? String(c.scraper_lead_id) : null,
      lead_search_id: c.search_id ? String(c.search_id) : null,
      source: {
        type: c.source_type ? String(c.source_type) : null,
        external_id: c.source_external_id ? String(c.source_external_id) : null,
        url: c.source_url ? String(c.source_url) : null,
      },
      scores: { quality: qualityScore, fit: fitScore, confidence },
    },
  };
}

export async function promoteToCanonicalLead(params: {
  admin: SupabaseClient;
  tenantId: string;
  ownerId: string;
  source: LeadPromotionSource;
  idempotencyKey?: string;
  skipQualificationGate?: boolean;
}): Promise<PromoteLeadResult> {
  const row: Record<string, unknown> =
    params.source.kind === 'lead_candidate'
      ? { ...params.source.candidate, _promotion_kind: 'lead_candidate', id: params.source.candidateId }
      : {
          ...params.source.row,
          _promotion_kind: 'scraper_lead',
          scraper_lead_id: params.source.scraperLeadId,
          id: params.source.scraperLeadId,
        };

  if (!params.skipQualificationGate && params.source.kind === 'lead_candidate') {
    const qualification = buildLeadQualification(row);
    if (!qualification.qualified) {
      throw Object.assign(new Error('LEAD_QUALIFICATION_FAILED'), {
        code: 'LEAD_QUALIFICATION_FAILED',
        details: qualification,
      });
    }
  }

  const sourceLabel =
    params.source.kind === 'scraper_lead'
      ? `Scraper:${String(row.source || row.campaign_id || 'scraper')}`
      : `Lead Finder:${String(row.source_type || row.search_id || 'discovery')}`;

  const payload = buildLeadPayloadFromCandidate(row, params.tenantId, params.ownerId, sourceLabel);
  const idempotencyKey =
    params.idempotencyKey?.trim() ||
    `lead-promote:${params.source.kind}:${params.source.kind === 'lead_candidate' ? params.source.candidateId : params.source.scraperLeadId}`;

  const gateway = await executeMcpWrite({
    tenantId: params.tenantId,
    userId: params.ownerId,
    tool: 'promote_lead_candidate',
    action: 'promote_lead',
    mode: 'execute_now',
    target: {
      workspace_id: params.tenantId,
      resource_type: 'lead',
      resource_id: idempotencyKey,
    },
    payload: { source: params.source.kind, payload },
    idempotencyKey,
    execute: async () => {
      const { data: existing } = await params.admin
        .from('leads')
        .select('*')
        .eq('tenant_id', params.tenantId)
        .eq('canonical_business_key', payload.canonical_business_key)
        .maybeSingle();

      if (existing) {
        return { lead: existing, created: false, duplicate: true };
      }

      const { data: inserted, error } = await params.admin
        .from('leads')
        .upsert(payload, { onConflict: 'tenant_id,canonical_business_key', ignoreDuplicates: false })
        .select()
        .maybeSingle();

      if (error && error.code !== '23505') throw error;

      const lead =
        inserted ||
        (
          await params.admin
            .from('leads')
            .select('*')
            .eq('tenant_id', params.tenantId)
            .eq('canonical_business_key', payload.canonical_business_key)
            .maybeSingle()
        ).data;

      if (!lead) throw new Error('Lead promotion failed — no lead row returned');

      const eventType = String(lead.stage || '').toLowerCase() === 'qualified' ? 'lead.qualified' : 'lead.created';
      await recordTenantEvent({
        tenantId: params.tenantId,
        actorId: params.ownerId,
        actorType: 'MCP',
        sourceModule: 'LEADS',
        action: eventType,
        title: eventType === 'lead.qualified' ? 'Lead qualified' : 'Lead created',
        leadId: String(lead.id),
        status: 'VERIFIED',
        metadata: { promotion_source: params.source.kind, idempotency_key: idempotencyKey },
      }).catch(() => undefined);

      if (params.source.kind === 'lead_candidate') {
        await params.admin
          .from('lead_candidates')
          .update({
            synced_lead_id: String(lead.id),
            review_status: 'accepted',
            updated_at: new Date().toISOString(),
          })
          .eq('workspace_id', params.tenantId)
          .eq('id', params.source.candidateId);
      }

      return { lead, created: true, duplicate: false };
    },
    buildReceipt: (result) => ({
      action_id: '',
      status: 'verified',
      timestamp: new Date().toISOString(),
      entity_type: 'lead',
      entity_id: String(result.lead.id),
    }),
    isSuccess: (r) => Boolean(r.lead?.id),
  });

  if (!gateway.ok || !gateway.result) {
    throw new Error(gateway.error?.message || 'Lead promotion failed');
  }

  return {
    lead: gateway.result.lead as Record<string, unknown>,
    created: gateway.result.created,
    duplicate: gateway.result.duplicate,
    promotion_id: gateway.actionId,
  };
}
