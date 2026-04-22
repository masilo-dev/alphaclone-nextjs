import type { SupabaseClient } from '@supabase/supabase-js';

const MODEL_VERSION = 1;
const round4 = (v: number) => Math.round(v * 10000) / 10000;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function sentimentScore(value: unknown): number {
  const s = String(value || '').toLowerCase();
  if (s === 'positive') return 1;
  if (s === 'negative') return -1;
  return 0;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export class ContactPsychologyService {
  async recomputeTenant(supabase: SupabaseClient, tenantId: string, limit = 250) {
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .order('last_activity_at', { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) throw error;

    let updated = 0;
    let failed = 0;
    for (const row of Array.isArray(contacts) ? (contacts as any[]) : []) {
      try {
        await this.recomputeContact(supabase, tenantId, String(row.id));
        updated++;
      } catch {
        failed++;
      }
    }
    return { updated, failed };
  }

  async recomputeContact(supabase: SupabaseClient, tenantId: string, contactId: string) {
    const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: messages, error } = await supabase
      .from('unified_messages')
      .select('direction, body, html_body, sentiment, received_at, sent_at, created_at')
      .eq('tenant_id', tenantId)
      .eq('contact_id', contactId)
      .gte('created_at', since90)
      .order('created_at', { ascending: true })
      .limit(1200);
    if (error) throw error;

    const rows = Array.isArray(messages) ? (messages as any[]) : [];
    let inbound = 0;
    let outbound = 0;
    let sentimentSum = 0;
    let sentimentN = 0;
    let questionCount = 0;
    let inboundLenSum = 0;
    let inboundLenN = 0;

    const responseSamplesH: number[] = [];
    let lastInboundAt: number | null = null;

    for (const m of rows) {
      const dir = String(m.direction || '');
      const text = String(m.body || m.html_body || '');
      const len = text.trim().length;
      if (dir === 'inbound') {
        inbound++;
        if (len) {
          inboundLenSum += len;
          inboundLenN++;
        }
        if (text.includes('?')) questionCount++;
        sentimentSum += sentimentScore(m.sentiment);
        sentimentN++;
        const t = m.received_at ? new Date(String(m.received_at)).getTime() : m.created_at ? new Date(String(m.created_at)).getTime() : null;
        if (t && Number.isFinite(t)) lastInboundAt = t;
      } else if (dir === 'outbound') {
        outbound++;
        const t = m.sent_at ? new Date(String(m.sent_at)).getTime() : m.created_at ? new Date(String(m.created_at)).getTime() : null;
        if (t && Number.isFinite(t) && lastInboundAt) {
          const diffH = (t - lastInboundAt) / (1000 * 60 * 60);
          if (diffH >= 0 && diffH <= 14 * 24) responseSamplesH.push(diffH);
          lastInboundAt = null;
        }
      }
    }

    const avgInboundLen = inboundLenN ? inboundLenSum / inboundLenN : 0;
    const avgSentiment = sentimentN ? sentimentSum / sentimentN : 0;
    const medianResponseH = median(responseSamplesH);

    const { data: roles } = await supabase
      .from('deal_stakeholders')
      .select('role, influence_weight')
      .eq('tenant_id', tenantId)
      .eq('contact_id', contactId);
    const roleRows = Array.isArray(roles) ? (roles as any[]) : [];
    const roleSet = new Set(roleRows.map((r) => String(r.role)));
    const influence = roleRows.reduce((s, r) => s + Number(r.influence_weight || 0), 0);

    const archetypes: string[] = [];
    if (avgInboundLen >= 500) archetypes.push('detail_oriented');
    if (questionCount >= Math.max(2, inbound * 0.35)) archetypes.push('information_seeking');
    if (medianResponseH > 0 && medianResponseH <= 6) archetypes.push('fast_responder');
    if (medianResponseH >= 48) archetypes.push('slow_responder');
    if (avgSentiment <= -0.25) archetypes.push('skeptical_or_risk_averse');
    if (avgSentiment >= 0.25) archetypes.push('positive_affinity');
    if (roleSet.has('decision_maker')) archetypes.push('decision_maker');
    if (roleSet.has('blocker')) archetypes.push('blocker');
    if (roleSet.has('champion')) archetypes.push('champion');
    if (!archetypes.length) archetypes.push('insufficient_signals');

    const conscientiousness = clamp((avgInboundLen / 800) * 0.6 + (questionCount / Math.max(1, inbound)) * 0.4, 0, 1);
    const agreeableness = clamp((avgSentiment + 1) / 2, 0, 1);
    const extraversion = clamp(inbound / Math.max(1, inbound + outbound), 0, 1);
    const openness = clamp((questionCount / Math.max(1, inbound)) * 0.9, 0, 1);
    const neuroticism = clamp(avgSentiment < 0 ? Math.abs(avgSentiment) : 0, 0, 1);

    const confidence = clamp(0.25 + Math.min(1, (inbound + outbound) / 40) * 0.45 + Math.min(1, roleRows.length / 3) * 0.15, 0.2, 0.95);

    const payload = {
      tenant_id: tenantId,
      contact_id: contactId,
      model_version: MODEL_VERSION,
      confidence: round4(confidence),
      big5: {
        openness: round4(openness),
        conscientiousness: round4(conscientiousness),
        extraversion: round4(extraversion),
        agreeableness: round4(agreeableness),
        neuroticism: round4(neuroticism),
      },
      archetypes,
      response_metrics: {
        inbound_count_90d: inbound,
        outbound_count_90d: outbound,
        avg_inbound_length: round4(avgInboundLen),
        avg_sentiment: round4(avgSentiment),
        median_response_hours: round4(medianResponseH),
      },
      influence_signals: {
        roles: Array.from(roleSet),
        influence_weight_sum: round4(influence),
      },
      updated_at: new Date().toISOString(),
    };

    const { error: upsertErr } = await supabase
      .from('contact_psychology_profiles')
      .upsert(payload, { onConflict: 'tenant_id,contact_id' });
    if (upsertErr) throw upsertErr;

    return payload;
  }
}

export const contactPsychologyService = new ContactPsychologyService();

