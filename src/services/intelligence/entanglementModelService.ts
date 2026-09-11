import type { SupabaseClient } from '@supabase/supabase-js';

type CorrelationModel = {
  model_version: number;
  sample_size: number;
  features: string[];
  correlations: {
    matrix: number[][];
    label_correlations: Record<string, number>;
    labels: string[];
  };
  feature_stats: Record<string, { mean: number; std: number; min: number; max: number }>;
};

const MODEL_VERSION = 1;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const round4 = (v: number) => Math.round(v * 10000) / 10000;

function pearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  if (!Number.isFinite(den) || den <= 1e-12) return 0;
  return round4(clamp(num / den, -1, 1));
}

function stats(values: number[]) {
  if (!values.length) return { mean: 0, std: 0, min: 0, max: 0 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / Math.max(1, values.length - 1);
  return { mean: round4(mean), std: round4(Math.sqrt(variance)), min: round4(min), max: round4(max) };
}

function sentimentToScore(value: unknown): number {
  const s = String(value || '').toLowerCase();
  if (s === 'positive') return 1;
  if (s === 'negative') return -1;
  return 0;
}

async function computeResponseHours30d(
  supabase: SupabaseClient,
  tenantId: string,
  contactId: string
): Promise<number> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('unified_messages')
    .select('direction, received_at, sent_at')
    .eq('tenant_id', tenantId)
    .eq('contact_id', contactId)
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw error;
  const rows = Array.isArray(data) ? (data as any[]) : [];

  let lastInbound: number | null = null;
  const samples: number[] = [];
  for (const row of rows) {
    const dir = String(row.direction || '');
    const t =
      dir === 'inbound'
        ? row.received_at
          ? new Date(String(row.received_at)).getTime()
          : null
        : row.sent_at
          ? new Date(String(row.sent_at)).getTime()
          : null;
    if (!t || !Number.isFinite(t)) continue;
    if (dir === 'inbound') {
      lastInbound = t;
      continue;
    }
    if (dir === 'outbound' && lastInbound) {
      const diffH = (t - lastInbound) / (1000 * 60 * 60);
      if (diffH >= 0 && diffH <= 14 * 24) samples.push(diffH);
      lastInbound = null;
    }
  }
  if (!samples.length) return 0;
  samples.sort((a, b) => a - b);
  return round4(samples[Math.floor(samples.length / 2)]);
}

export class EntanglementModelService {
  async buildTenantModel(supabase: SupabaseClient, tenantId: string): Promise<CorrelationModel> {
    const { data: deals, error } = await supabase
      .from('deals')
      .select('id, tenant_id, contact_id, stage, probability, value, competitor_info, updated_at')
      .eq('tenant_id', tenantId)
      .in('stage', ['closed_won', 'closed_lost'])
      .order('updated_at', { ascending: false })
      .limit(400);
    if (error) throw error;
    const rows = Array.isArray(deals) ? (deals as any[]) : [];

    const featureNames = [
      'decision_maker_present',
      'competitor_present',
      'probability_pct',
      'deal_value',
      'inbound_sentiment_avg_30d',
      'inbound_count_30d',
      'outbound_count_30d',
      'median_response_hours_30d',
      'deal_activity_count_30d',
    ];
    const labels = ['win'];

    const X: Record<string, number[]> = Object.fromEntries(featureNames.map((f) => [f, []]));
    const Y: Record<string, number[]> = Object.fromEntries(labels.map((l) => [l, []]));

    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    for (const d of rows) {
      const dealId = String(d.id);
      const contactId = d.contact_id ? String(d.contact_id) : null;

      const { data: stakeholders } = await supabase
        .from('deal_stakeholders')
        .select('role')
        .eq('tenant_id', tenantId)
        .eq('deal_id', dealId);
      const hasDM = Array.isArray(stakeholders) ? stakeholders.some((s: any) => String(s.role) === 'decision_maker') : false;

      const competitor = Boolean(d.competitor_info && String(d.competitor_info).trim().length > 0);

      let inboundCount = 0;
      let outboundCount = 0;
      let sentimentSum = 0;
      let sentimentN = 0;
      let medianResponseHours = 0;

      if (contactId) {
        const { data: msgs } = await supabase
          .from('unified_messages')
          .select('direction, sentiment, created_at')
          .eq('tenant_id', tenantId)
          .eq('contact_id', contactId)
          .gte('created_at', since30)
          .limit(500);
        const mrows = Array.isArray(msgs) ? (msgs as any[]) : [];
        for (const m of mrows) {
          const dir = String(m.direction || '');
          if (dir === 'inbound') {
            inboundCount += 1;
            sentimentSum += sentimentToScore(m.sentiment);
            sentimentN += 1;
          } else if (dir === 'outbound') {
            outboundCount += 1;
          }
        }
        medianResponseHours = await computeResponseHours30d(supabase, tenantId, contactId);
      }

      const inboundSentimentAvg = sentimentN ? round4(sentimentSum / sentimentN) : 0;

      const { count: activityCount } = await supabase
        .from('deal_activities')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('deal_id', dealId)
        .gte('created_at', since30);

      const prob = Number(d.probability || 0);
      const dealValue = Number(d.value || 0);

      X.decision_maker_present.push(hasDM ? 1 : 0);
      X.competitor_present.push(competitor ? 1 : 0);
      X.probability_pct.push(prob);
      X.deal_value.push(dealValue);
      X.inbound_sentiment_avg_30d.push(inboundSentimentAvg);
      X.inbound_count_30d.push(inboundCount);
      X.outbound_count_30d.push(outboundCount);
      X.median_response_hours_30d.push(medianResponseHours);
      X.deal_activity_count_30d.push(Number(activityCount || 0));

      Y.win.push(String(d.stage) === 'closed_won' ? 1 : 0);
    }

    const sampleSize = Y.win.length;

    const matrix: number[][] = [];
    for (let i = 0; i < featureNames.length; i++) {
      const row: number[] = [];
      for (let j = 0; j < featureNames.length; j++) {
        row.push(i === j ? 1 : pearson(X[featureNames[i]], X[featureNames[j]]));
      }
      matrix.push(row);
    }

    const labelCorr: Record<string, number> = {};
    for (const f of featureNames) {
      labelCorr[`win:${f}`] = pearson(X[f], Y.win);
    }

    const featureStats: CorrelationModel['feature_stats'] = {};
    for (const f of featureNames) featureStats[f] = stats(X[f]);

    return {
      model_version: MODEL_VERSION,
      sample_size: sampleSize,
      features: featureNames,
      correlations: { matrix, label_correlations: labelCorr, labels },
      feature_stats: featureStats,
    };
  }

  async persistTenantModel(supabase: SupabaseClient, tenantId: string) {
    const model = await this.buildTenantModel(supabase, tenantId);
    const { error } = await supabase
      .from('intelligence_correlation_models')
      .upsert(
        {
          tenant_id: tenantId,
          model_version: model.model_version,
          sample_size: model.sample_size,
          features: model.features,
          correlations: model.correlations as any,
          feature_stats: model.feature_stats as any,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,model_version' }
      );
    if (error) throw error;
    return model;
  }
}

export const entanglementModelService = new EntanglementModelService();

