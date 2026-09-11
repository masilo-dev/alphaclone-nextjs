import type { SupabaseClient } from '@supabase/supabase-js';

export type DealStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';

export type IntelligenceEventType =
  | 'stage_change'
  | 'proposal_sent'
  | 'email_sent'
  | 'email_opened'
  | 'email_clicked'
  | 'call_completed'
  | 'meeting_completed'
  | 'decision_maker_engaged'
  | 'budget_confirmed'
  | 'competitor_mentioned'
  | 'silence_detected'
  | 'note_added'
  | 'deal_won'
  | 'deal_lost';

export type QuantumStateKey = 'close_this_quarter' | 'close_next_quarter' | 'lost_forever' | 'stalled_indefinitely';

export interface QuantumSuperposition {
  close_this_quarter: number;
  close_next_quarter: number;
  lost_forever: number;
  stalled_indefinitely: number;
}

export interface ActionValue {
  action: string;
  value_bits: number;
  rationale: string;
}

export interface QuantumDealState {
  version: number;
  updated_at: string;
  stage: DealStage;
  superposition: QuantumSuperposition;
  close_probability: number;
  confidence: number;
  entropy_bits: number;
  risk_level: number;
  expected_days_to_close: number | null;
  expected_revenue: number;
  influence_graph: {
    stakeholders: Array<{ contact_id: string; role: string; influence_weight: number }>;
  };
  monte_carlo: {
    iterations: number;
    p50_revenue: number;
    p90_revenue: number;
    p10_revenue: number;
    close_within_days: Record<string, number>;
  };
  recommendations: string[];
  top_actions: ActionValue[];
  evidence: {
    days_since_last_activity: number | null;
    recent_activity_count_14d: number;
    last_stage_change_at: string | null;
    has_recent_proposal: boolean;
    has_recent_call: boolean;
    has_recent_meeting: boolean;
  };
}

const VERSION = 1;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const round4 = (v: number) => Math.round(v * 10000) / 10000;

function normalizeSuperposition(s: QuantumSuperposition): QuantumSuperposition {
  const total = s.close_this_quarter + s.close_next_quarter + s.lost_forever + s.stalled_indefinitely;
  if (total <= 0) {
    return { close_this_quarter: 0.25, close_next_quarter: 0.25, lost_forever: 0.25, stalled_indefinitely: 0.25 };
  }
  return {
    close_this_quarter: round4(s.close_this_quarter / total),
    close_next_quarter: round4(s.close_next_quarter / total),
    lost_forever: round4(s.lost_forever / total),
    stalled_indefinitely: round4(s.stalled_indefinitely / total),
  };
}

function entropyBits(s: QuantumSuperposition): number {
  const p = [s.close_this_quarter, s.close_next_quarter, s.lost_forever, s.stalled_indefinitely].filter((x) => x > 0);
  const h = p.reduce((sum, x) => sum - x * Math.log2(x), 0);
  return round4(h);
}

function baseSuperposition(stage: DealStage): QuantumSuperposition {
  switch (stage) {
    case 'lead':
      return { close_this_quarter: 0.2, close_next_quarter: 0.25, lost_forever: 0.35, stalled_indefinitely: 0.2 };
    case 'qualified':
      return { close_this_quarter: 0.3, close_next_quarter: 0.3, lost_forever: 0.25, stalled_indefinitely: 0.15 };
    case 'proposal':
      return { close_this_quarter: 0.45, close_next_quarter: 0.25, lost_forever: 0.2, stalled_indefinitely: 0.1 };
    case 'negotiation':
      return { close_this_quarter: 0.6, close_next_quarter: 0.2, lost_forever: 0.15, stalled_indefinitely: 0.05 };
    case 'closed_won':
      return { close_this_quarter: 1, close_next_quarter: 0, lost_forever: 0, stalled_indefinitely: 0 };
    case 'closed_lost':
      return { close_this_quarter: 0, close_next_quarter: 0, lost_forever: 1, stalled_indefinitely: 0 };
  }
}

function multiplyState(
  s: QuantumSuperposition,
  multipliers: Partial<Record<QuantumStateKey, number>>
): QuantumSuperposition {
  return normalizeSuperposition({
    close_this_quarter: s.close_this_quarter * (multipliers.close_this_quarter ?? 1),
    close_next_quarter: s.close_next_quarter * (multipliers.close_next_quarter ?? 1),
    lost_forever: s.lost_forever * (multipliers.lost_forever ?? 1),
    stalled_indefinitely: s.stalled_indefinitely * (multipliers.stalled_indefinitely ?? 1),
  });
}

type TransitionMatrix = Record<DealStage, Partial<Record<DealStage, number>>>;

const DEFAULT_TRANSITIONS: TransitionMatrix = {
  lead: { lead: 0.3, qualified: 0.6, proposal: 0.05, negotiation: 0.02, closed_lost: 0.03 },
  qualified: { qualified: 0.2, proposal: 0.65, negotiation: 0.1, closed_lost: 0.05 },
  proposal: { proposal: 0.15, negotiation: 0.6, closed_won: 0.15, closed_lost: 0.1 },
  negotiation: { negotiation: 0.4, closed_won: 0.45, closed_lost: 0.15 },
  closed_won: { closed_won: 1 },
  closed_lost: { closed_lost: 1 },
};

const DEFAULT_STAGE_DAYS: Record<DealStage, number> = {
  lead: 30,
  qualified: 45,
  proposal: 30,
  negotiation: 14,
  closed_won: 0,
  closed_lost: 0,
};

function estimateMarkovOutcomes(stage: DealStage): { pClose: number; expectedDays: number | null } {
  if (stage === 'closed_won') return { pClose: 1, expectedDays: 0 };
  if (stage === 'closed_lost') return { pClose: 0, expectedDays: 0 };

  const states: DealStage[] = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
  const idx = new Map<DealStage, number>(states.map((s, i) => [s, i]));

  const N = states.length;
  const P: number[][] = Array.from({ length: N }, () => Array.from({ length: N }, () => 0));
  for (const from of states) {
    const row = DEFAULT_TRANSITIONS[from] || {};
    const fromI = idx.get(from)!;
    let sum = 0;
    for (const to of Object.keys(row) as DealStage[]) {
      const val = Number((row as any)[to] || 0);
      P[fromI][idx.get(to)!] = val;
      sum += val;
    }
    if (sum > 0 && Math.abs(sum - 1) > 1e-6) {
      for (let j = 0; j < N; j++) P[fromI][j] = P[fromI][j] / sum;
    }
  }

  const absorbWon = idx.get('closed_won')!;
  const absorbLost = idx.get('closed_lost')!;
  const transient = states.filter((s) => s !== 'closed_won' && s !== 'closed_lost');
  const tIdx = transient.map((s) => idx.get(s)!);

  const tN = transient.length;
  const Q: number[][] = Array.from({ length: tN }, () => Array.from({ length: tN }, () => 0));
  const R: number[][] = Array.from({ length: tN }, () => [0, 0]);
  for (let i = 0; i < tN; i++) {
    for (let j = 0; j < tN; j++) Q[i][j] = P[tIdx[i]][tIdx[j]];
    R[i][0] = P[tIdx[i]][absorbWon];
    R[i][1] = P[tIdx[i]][absorbLost];
  }

  const IminusQ: number[][] = Array.from({ length: tN }, (_, i) =>
    Array.from({ length: tN }, (_, j) => (i === j ? 1 : 0) - Q[i][j])
  );

  const inv = invertMatrix(IminusQ);
  if (!inv) {
    return { pClose: clamp((baseSuperposition(stage).close_this_quarter + baseSuperposition(stage).close_next_quarter), 0, 1), expectedDays: null };
  }

  const B = multiplyMatrices(inv, R);
  const stageRow = transient.indexOf(stage);
  const pClose = stageRow >= 0 ? B[stageRow][0] : 0;

  const ones = Array.from({ length: tN }, () => [1]);
  const expectedSteps = multiplyMatrices(inv, ones);
  const steps = stageRow >= 0 ? expectedSteps[stageRow][0] : 0;
  const avgStageDays =
    transient.reduce((sum, s) => sum + (DEFAULT_STAGE_DAYS[s] || 0), 0) / Math.max(1, transient.length);
  const expectedDays = Math.round(steps * avgStageDays);

  return { pClose: round4(clamp(pClose, 0, 1)), expectedDays: Number.isFinite(expectedDays) ? expectedDays : null };
}

function invertMatrix(A: number[][]): number[][] | null {
  const n = A.length;
  if (n === 0 || A.some((row) => row.length !== n)) return null;

  const M = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row;
    }
    if (Math.abs(M[pivot][col]) < 1e-12) return null;
    if (pivot !== col) {
      const tmp = M[col];
      M[col] = M[pivot];
      M[pivot] = tmp;
    }

    const div = M[col][col];
    for (let j = 0; j < 2 * n; j++) M[col][j] /= div;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      if (factor === 0) continue;
      for (let j = 0; j < 2 * n; j++) M[row][j] -= factor * M[col][j];
    }
  }

  return M.map((row) => row.slice(n));
}

function multiplyMatrices(A: number[][], B: number[][]): number[][] {
  const aRows = A.length;
  const aCols = A[0]?.length || 0;
  const bRows = B.length;
  const bCols = B[0]?.length || 0;
  if (aCols !== bRows) return Array.from({ length: aRows }, () => Array.from({ length: bCols }, () => 0));

  const out: number[][] = Array.from({ length: aRows }, () => Array.from({ length: bCols }, () => 0));
  for (let i = 0; i < aRows; i++) {
    for (let k = 0; k < aCols; k++) {
      const aik = A[i][k];
      if (aik === 0) continue;
      for (let j = 0; j < bCols; j++) out[i][j] += aik * B[k][j];
    }
  }
  return out;
}

function monteCarloRevenue(params: {
  dealValue: number;
  closeProbability: number;
  expectedDays: number | null;
  iterations: number;
}): { p50: number; p90: number; p10: number; closeWithinDays: Record<string, number> } {
  const samples: number[] = [];
  const closeCounts: Record<string, number> = { '30': 0, '60': 0, '90': 0 };
  const expected = params.expectedDays ?? 60;
  const sigma = Math.max(8, expected * 0.35);

  for (let i = 0; i < params.iterations; i++) {
    const u = Math.random();
    const closes = u < params.closeProbability;
    if (!closes) {
      samples.push(0);
      continue;
    }

    const day = clamp(Math.round(normalRandom(expected, sigma)), 1, 365);
    if (day <= 30) closeCounts['30']++;
    if (day <= 60) closeCounts['60']++;
    if (day <= 90) closeCounts['90']++;

    samples.push(params.dealValue);
  }

  samples.sort((a, b) => a - b);
  const p = (q: number) => samples[Math.max(0, Math.min(samples.length - 1, Math.floor(q * (samples.length - 1))))] || 0;
  return {
    p50: p(0.5),
    p90: p(0.9),
    p10: p(0.1),
    closeWithinDays: {
      '30': round4(closeCounts['30'] / params.iterations),
      '60': round4(closeCounts['60'] / params.iterations),
      '90': round4(closeCounts['90'] / params.iterations),
    },
  };
}

function normalRandom(mean: number, std: number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + std * z;
}

function computeActionValues(input: { stage: DealStage; daysSinceLastActivity: number | null; entropy: number }): ActionValue[] {
  const values: ActionValue[] = [];
  const base = input.entropy;

  const callValue = input.daysSinceLastActivity !== null && input.daysSinceLastActivity >= 5 ? 1.25 : 0.9;
  values.push({ action: 'request_call', value_bits: round4(clamp(callValue, 0, base)), rationale: 'Highest information gain by forcing a definitive response.' });

  const dmValue = input.stage === 'qualified' || input.stage === 'proposal' ? 1.1 : 0.7;
  values.push({ action: 'involve_decision_maker', value_bits: round4(clamp(dmValue, 0, base)), rationale: 'Decision-maker involvement reduces outcome uncertainty.' });

  const proposalValue = input.stage === 'qualified' ? 0.9 : 0.45;
  values.push({ action: 'send_proposal', value_bits: round4(clamp(proposalValue, 0, base)), rationale: 'Creates an observable commitment milestone.' });

  values.push({ action: 'send_value_asset', value_bits: round4(clamp(0.6, 0, base)), rationale: 'Re-engages without high-friction ask.' });
  values.push({ action: 'wait', value_bits: 0, rationale: 'No entropy reduction.' });

  return values.sort((a, b) => b.value_bits - a.value_bits).slice(0, 5);
}

function computeRecommendations(params: {
  stage: DealStage;
  superposition: QuantumSuperposition;
  daysSinceLastActivity: number | null;
  evidence: QuantumDealState['evidence'];
}): string[] {
  const rec: string[] = [];

  const closeNow = params.superposition.close_this_quarter;
  const closeLater = params.superposition.close_next_quarter;
  const lost = params.superposition.lost_forever;
  const stalled = params.superposition.stalled_indefinitely;

  if (closeNow >= 0.6) rec.push('Focus on close-plan execution: confirm next step, date, and decision path.');
  if (closeNow >= 0.4 && params.evidence.has_recent_proposal === false && (params.stage === 'qualified' || params.stage === 'proposal')) {
    rec.push('Send a proposal or structured summary to create a measurable decision moment.');
  }
  if (params.daysSinceLastActivity !== null && params.daysSinceLastActivity >= 7) rec.push('Deal is going cold: schedule a direct call to collapse ambiguity.');
  if (stalled >= 0.25) rec.push('Run a stall-recovery script: ask for a clear yes/no and identify blockers.');
  if (lost >= 0.2) rec.push('Capture loss risks early: confirm budget, authority, and timeline explicitly.');
  if (closeLater >= 0.35) rec.push('Align timeline: convert to next-quarter plan with scheduled checkpoints.');

  return Array.from(new Set(rec)).slice(0, 7);
}

function computeConfidence(params: {
  stage: DealStage;
  recentActivityCount14d: number;
  daysSinceLastActivity: number | null;
  hasRecentProposal: boolean;
}): number {
  let c = 0.35;
  c += Math.min(0.25, params.recentActivityCount14d / 40);
  if (params.hasRecentProposal) c += 0.12;
  if (params.daysSinceLastActivity !== null && params.daysSinceLastActivity <= 2) c += 0.08;
  if (params.stage === 'negotiation') c += 0.08;
  if (params.stage === 'lead') c -= 0.05;
  return round4(clamp(c, 0.2, 0.95));
}

function computeRisk(superposition: QuantumSuperposition, confidence: number): number {
  const nonClose = 1 - (superposition.close_this_quarter + superposition.close_next_quarter);
  return round4(clamp(nonClose * (1 - confidence * 0.6), 0, 1));
}

class QuantumDealIntelligenceService {
  async recomputeDeal(supabase: SupabaseClient, tenantId: string, dealId: string): Promise<QuantumDealState> {
    const { data: deal, error } = await supabase
      .from('deals')
      .select('id, tenant_id, stage, value, expected_close_date, created_at, updated_at, competitor_info, next_step')
      .eq('tenant_id', tenantId)
      .eq('id', dealId)
      .single();

    if (error || !deal) {
      throw new Error('Deal not found');
    }

    const stage = deal.stage as DealStage;

    const { data: stakeholdersRows } = await supabase
      .from('deal_stakeholders')
      .select('contact_id, role, influence_weight')
      .eq('tenant_id', tenantId)
      .eq('deal_id', dealId)
      .limit(50);
    const stakeholders = Array.isArray(stakeholdersRows)
      ? (stakeholdersRows as any[]).map((r) => ({
          contact_id: String(r.contact_id),
          role: String(r.role || ''),
          influence_weight: Number(r.influence_weight || 0),
        }))
      : [];
    const hasDecisionMaker = stakeholders.some((s) => s.role === 'decision_maker');
    const hasBlocker = stakeholders.some((s) => s.role === 'blocker');

    const { data: activities } = await supabase
      .from('deal_activities')
      .select('activity_type, created_at')
      .eq('tenant_id', tenantId)
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
      .limit(200);

    const now = Date.now();
    const activityList = Array.isArray(activities) ? activities : [];
    const lastAt = activityList[0]?.created_at ? new Date(String(activityList[0].created_at)).getTime() : null;
    const daysSinceLastActivity = lastAt ? Math.floor((now - lastAt) / (1000 * 60 * 60 * 24)) : null;
    const cutoff14d = now - 14 * 24 * 60 * 60 * 1000;
    const recent14d = activityList.filter((a: any) => {
      const t = a.created_at ? new Date(String(a.created_at)).getTime() : 0;
      return t >= cutoff14d;
    });

    const lastStageChange = activityList.find((a: any) => String(a.activity_type) === 'stage_change');
    const lastStageChangeAt = lastStageChange?.created_at ? String(lastStageChange.created_at) : null;

    const hasRecentProposal = recent14d.some((a: any) => String(a.activity_type) === 'proposal_sent');
    const hasRecentCall = recent14d.some((a: any) => String(a.activity_type) === 'call');
    const hasRecentMeeting = recent14d.some((a: any) => String(a.activity_type) === 'meeting');

    let s = normalizeSuperposition(baseSuperposition(stage));

    if (hasDecisionMaker) {
      s = multiplyState(s, { close_this_quarter: 1.1, close_next_quarter: 1.05, lost_forever: 0.92 });
    }
    if (hasBlocker) {
      s = multiplyState(s, { lost_forever: 1.15, stalled_indefinitely: 1.05, close_this_quarter: 0.9 });
    }

    const expectedCloseAt = deal.expected_close_date ? new Date(String(deal.expected_close_date)).getTime() : null;
    if (expectedCloseAt && Number.isFinite(expectedCloseAt)) {
      const daysToClose = Math.floor((expectedCloseAt - now) / (1000 * 60 * 60 * 24));
      if (daysToClose <= 0) {
        s = multiplyState(s, { stalled_indefinitely: 1.25, close_this_quarter: 0.9 });
      } else if (daysToClose <= 90) {
        s = multiplyState(s, { close_this_quarter: 1.18, close_next_quarter: 0.92 });
      } else if (daysToClose <= 180) {
        s = multiplyState(s, { close_next_quarter: 1.12, close_this_quarter: 0.95 });
      } else {
        s = multiplyState(s, { stalled_indefinitely: 1.12, close_next_quarter: 1.05, close_this_quarter: 0.85 });
      }
    }

    if (daysSinceLastActivity !== null) {
      if (daysSinceLastActivity <= 2) {
        s = multiplyState(s, { close_this_quarter: 1.25, stalled_indefinitely: 0.85, lost_forever: 0.9 });
      } else if (daysSinceLastActivity >= 14) {
        s = multiplyState(s, { close_this_quarter: 0.8, close_next_quarter: 0.9, stalled_indefinitely: 1.3, lost_forever: 1.15 });
      } else if (daysSinceLastActivity >= 7) {
        s = multiplyState(s, { close_this_quarter: 0.9, stalled_indefinitely: 1.15, lost_forever: 1.05 });
      }
    }

    if (lastStageChangeAt) {
      const t = new Date(lastStageChangeAt).getTime();
      if (Number.isFinite(t) && now - t <= 7 * 24 * 60 * 60 * 1000) {
        s = multiplyState(s, { close_this_quarter: 1.12, close_next_quarter: 1.05, stalled_indefinitely: 0.9 });
      }
    }

    if (hasRecentProposal) {
      s = multiplyState(s, { close_this_quarter: 1.18, close_next_quarter: 1.08, stalled_indefinitely: 0.88 });
    }
    if (hasRecentCall || hasRecentMeeting) {
      s = multiplyState(s, { close_this_quarter: 1.12, stalled_indefinitely: 0.9, lost_forever: 0.95 });
    }

    if (deal.competitor_info && String(deal.competitor_info).trim().length > 0) {
      s = multiplyState(s, { lost_forever: 1.15, close_this_quarter: 0.92 });
    }

    if (deal.next_step && String(deal.next_step).toLowerCase().includes('decision')) {
      s = multiplyState(s, { close_this_quarter: 1.08, close_next_quarter: 1.05, stalled_indefinitely: 0.9 });
    }

    if (stage === 'closed_lost' && daysSinceLastActivity !== null && daysSinceLastActivity <= 60) {
      s = normalizeSuperposition({
        close_this_quarter: 0,
        close_next_quarter: 0.23,
        lost_forever: 0.77,
        stalled_indefinitely: 0,
      });
    }

    const e = {
      days_since_last_activity: daysSinceLastActivity,
      recent_activity_count_14d: recent14d.length,
      last_stage_change_at: lastStageChangeAt,
      has_recent_proposal: hasRecentProposal,
      has_recent_call: hasRecentCall,
      has_recent_meeting: hasRecentMeeting,
    };

    const confidence = computeConfidence({
      stage,
      recentActivityCount14d: e.recent_activity_count_14d,
      daysSinceLastActivity,
      hasRecentProposal,
    });

    const closeProbability = round4(clamp(s.close_this_quarter + s.close_next_quarter, 0.001, 0.999));
    const entropy = entropyBits(s);
    const riskLevel = computeRisk(s, confidence);

    const markov = estimateMarkovOutcomes(stage);
    const expectedDaysToClose = markov.expectedDays;

    const mc = monteCarloRevenue({
      dealValue: Number(deal.value || 0),
      closeProbability: closeProbability,
      expectedDays: expectedDaysToClose,
      iterations: 1200,
    });

    const actions = computeActionValues({ stage, daysSinceLastActivity, entropy });
    const recommendations = computeRecommendations({ stage, superposition: s, daysSinceLastActivity, evidence: e });

    const state: QuantumDealState = {
      version: VERSION,
      updated_at: new Date().toISOString(),
      stage,
      superposition: s,
      close_probability: closeProbability,
      confidence,
      entropy_bits: entropy,
      risk_level: riskLevel,
      expected_days_to_close: expectedDaysToClose,
      expected_revenue: Number(deal.value || 0) * closeProbability,
      influence_graph: { stakeholders },
      monte_carlo: {
        iterations: 1200,
        p50_revenue: mc.p50,
        p90_revenue: mc.p90,
        p10_revenue: mc.p10,
        close_within_days: mc.closeWithinDays,
      },
      recommendations,
      top_actions: actions,
      evidence: e,
    };

    const intelligenceScore = round4(closeProbability * 100);
    const intelligenceConfidence = round4(confidence * 100);

    const { error: updateErr } = await supabase
      .from('deals')
      .update({
        probability: Math.round(closeProbability * 100),
        intelligence_score: intelligenceScore,
        intelligence_confidence: intelligenceConfidence,
        intelligence_state: state as any,
        intelligence_recommendations: recommendations,
      })
      .eq('tenant_id', tenantId)
      .eq('id', dealId);

    if (updateErr) {
      throw updateErr;
    }

    return state;
  }

  async recomputeTenant(supabase: SupabaseClient, tenantId: string, limit = 250): Promise<{ updated: number; failed: number }> {
    const { data: deals, error } = await supabase
      .from('deals')
      .select('id')
      .eq('tenant_id', tenantId)
      .not('stage', 'in', '(closed_won,closed_lost)')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    let updated = 0;
    let failed = 0;
    for (const row of Array.isArray(deals) ? (deals as any[]) : []) {
      try {
        await this.recomputeDeal(supabase, tenantId, String(row.id));
        updated++;
      } catch {
        failed++;
      }
    }

    return { updated, failed };
  }
}

export const quantumDealIntelligenceService = new QuantumDealIntelligenceService();
