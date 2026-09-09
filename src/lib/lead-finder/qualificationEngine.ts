import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export type QualificationSignal = {
  signal_type: string; signal_category: string; signal_value: string; source_type: string;
  source_url?: string | null; observed_at: string; expires_at?: string | null;
  confidence: number; weight: number; raw_evidence?: Record<string, unknown>;
};

type Candidate = Record<string, unknown>;
type Relationship = { state: string; lastContactAt: string | null; contactAttempts: number };
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const nowIso = () => new Date().toISOString();
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

function relationshipModifier(state: string) {
  return ['customer', 'do_not_contact', 'unsubscribed'].includes(state) ? -100 : state === 'lost' ? -35 : 0;
}

export function buildLeadQualification(candidate: Candidate, relationship: Relationship = { state: 'new', lastContactAt: null, contactAttempts: 0 }) {
  const observedAt = nowIso();
  const sourceUrl = typeof candidate.source_url === 'string' ? candidate.source_url : typeof candidate.website === 'string' ? candidate.website : null;
  const hasEmail = Boolean(candidate.public_email);
  const hasPhone = Boolean(candidate.public_phone);
  const hasWebsite = Boolean(candidate.website);
  const quality = Number(candidate.quality_score || 0);
  const fit = clamp(Number(candidate.fit_score || 0));
  const confidence = clamp(Number(candidate.confidence_score || 0));
  const raw = (candidate.raw_data || {}) as Record<string, unknown>;
  const crawl = (raw.crawl_quality || {}) as { problems?: string[]; opportunity_score?: number; website_quality_score?: number };
  const problems = Array.isArray(crawl.problems) ? crawl.problems.filter((x): x is string => typeof x === 'string') : [];
  const signals: QualificationSignal[] = [];
  const add = (signal: Omit<QualificationSignal, 'observed_at'>) => signals.push({ ...signal, observed_at: observedAt });

  add({ signal_type: 'business_identity', signal_category: 'identity', signal_value: String(candidate.business_name || 'Business'), source_type: String(candidate.source_type || 'discovery'), source_url: sourceUrl, confidence: 85, weight: 0, raw_evidence: { industry: candidate.industry, city: candidate.city, country: candidate.country } });
  if (hasEmail) add({ signal_type: 'public_email', signal_category: 'reachability', signal_value: String(candidate.public_email), source_type: 'public_website', source_url: sourceUrl, confidence: 90, weight: 15, expires_at: inDays(90) });
  if (hasPhone) add({ signal_type: 'public_phone', signal_category: 'reachability', signal_value: String(candidate.public_phone), source_type: String(candidate.source_type || 'discovery'), source_url: sourceUrl, confidence: 82, weight: 12, expires_at: inDays(90) });
  if (hasWebsite) add({ signal_type: 'website_present', signal_category: 'digital', signal_value: 'Public website reachable at discovery', source_type: 'public_website', source_url: sourceUrl, confidence: 70, weight: 5, expires_at: inDays(30) });

  const opportunities: Array<Record<string, unknown>> = [];
  const observable = (problem: string, category: string, severity: number, inference: string) => {
    opportunities.push({ category, observation: problem, inference, severity: clamp(severity), confidence: 78, evidence_url: sourceUrl });
    add({ signal_type: `observable_${category}_gap`, signal_category: category, signal_value: problem, source_type: 'public_website', source_url: sourceUrl, confidence: 78, weight: clamp(severity / 3), expires_at: inDays(21), raw_evidence: { observation: problem, inference } });
  };
  if (!hasWebsite) observable('No public website was found in the discovery sources.', 'website', 65, 'Potential website and lead-capture opportunity.');
  if (problems.includes('no_visible_contact_cta')) observable('No visible contact, enquiry, or telephone CTA was found on the public website.', 'lead_generation', 75, 'Potential website lead-capture opportunity.');
  if (problems.includes('https_missing')) observable('The public website does not use HTTPS.', 'website', 58, 'Potential website trust and conversion improvement.');
  if (problems.includes('responsive_viewport_missing')) observable('No responsive viewport declaration was found on the public website.', 'website', 62, 'Potential mobile website improvement.');
  if (problems.includes('structured_data_missing')) observable('No structured business data markup was found on the public website.', 'marketing', 42, 'Potential search visibility improvement.');

  const need = clamp(opportunities.reduce((sum, item) => sum + Number(item.severity || 0), 0) / Math.max(1, opportunities.length));
  const digitalMaturity = clamp(hasWebsite ? 75 - problems.length * 11 + (hasEmail ? 5 : 0) : 15);
  // Discovery sources rarely establish a company's age. Keep maturity unknown
  // unless there is direct, durable public evidence rather than guessing size.
  const businessMaturity = 'unknown';
  const reachability = clamp((hasEmail ? 50 : 0) + (hasPhone ? 35 : 0) + (hasWebsite ? 15 : 0));
  const freshness = clamp(candidate.last_seen_at || candidate.discovered_at ? 90 : 45);
  const whyNow = clamp((opportunities.length ? 40 : 8) + (freshness >= 80 ? 22 : 0) + (hasWebsite ? 8 : 0));
  const intent = clamp((hasWebsite ? 25 : 0) + (hasEmail || hasPhone ? 25 : 0) + (opportunities.length ? 25 : 0) + Math.min(25, quality / 4));
  const alphaOpportunity = clamp(need * 0.55 + (100 - digitalMaturity) * 0.25 + fit * 0.20);
  const relationshipState = relationship.state || 'new';
  const master = clamp(
    fit * .20 + need * .15 + whyNow * .15 + intent * .10 + reachability * .10 +
    alphaOpportunity * .15 + freshness * .05 + confidence * .10 + relationshipModifier(relationshipState)
  );
  const grade = relationshipModifier(relationshipState) < 0 || master < 40 ? 'Reject' : master >= 85 ? 'A' : master >= 70 ? 'B' : master >= 55 ? 'C' : 'D';
  const priority = relationshipModifier(relationshipState) < 0 ? 'ignore' : master >= 90 ? 'immediate' : master >= 75 ? 'high' : master >= 55 ? 'medium' : master >= 30 ? 'low' : 'ignore';
  const why = `Matches the selected business profile${candidate.industry ? ` in ${String(candidate.industry)}` : ''}${candidate.city ? ` around ${String(candidate.city)}` : ''}, with ${opportunities.length ? 'observable digital gaps' : 'public business evidence'} available for review.`;
  const whyNowText = opportunities.length
    ? `Public evidence was checked recently and ${opportunities[0].observation}`
    : 'No strong timing signal detected from the currently available public evidence.';
  const prohibited = ['customer', 'do_not_contact', 'unsubscribed'].includes(relationshipState);
  const action = prohibited ? (relationshipState === 'customer' ? 'customer_success' : 'do_not_contact') : reachability < 35 ? 'find_contact' : master >= 70 ? 'prepare_outreach' : 'review';
  const offer = opportunities.some((x) => x.category === 'lead_generation')
    ? { primary_offer: 'Website Lead Capture', secondary_offer: 'CRM Follow-up Automation', reason: 'A public lead-capture gap was observed.' }
    : opportunities.length ? { primary_offer: 'Website Improvement', reason: 'Observable public website gaps were found.' }
    : { primary_offer: null, reason: 'No specific AlphaClone offer is recommended without stronger evidence.' };
  const summary = `Score: ${master}/100 — ${priority} priority. WHY: ${why} WHY NOW: ${whyNowText} CONTACTABILITY: ${hasEmail && hasPhone ? 'public email and phone found' : hasEmail || hasPhone ? 'one public contact method found' : 'no public contact method found'}. HISTORY: ${relationshipState}. NEXT ACTION: ${action.replaceAll('_', ' ')}.`;

  return {
    signals, fit_score: fit, need_score: need, intent_score: intent, why_now_score: whyNow,
    reachability_score: reachability, freshness_score: freshness, confidence_score: confidence,
    alphaclone_opportunity_score: alphaOpportunity, digital_maturity_score: digitalMaturity,
    business_maturity: businessMaturity, business_maturity_confidence: 0,
    master_score: master, grade, priority_band: priority, relationship_state: relationshipState,
    buying_stage: prohibited ? 'do_not_contact' : master >= 70 && reachability >= 50 ? 'contactable' : master >= 55 ? 'potential_fit' : 'unqualified',
    qualification_reason: why, why_now: whyNowText, qualification_summary: summary,
    recommended_offer: offer, recommended_action: action, next_best_action_reason: prohibited ? 'Relationship history prohibits cold outreach.' : `Based on ${opportunities.length ? 'observable opportunities' : 'available evidence'} and reachability.`,
    outreach_angle: prohibited || !opportunities.length ? null : `Discuss ${String(opportunities[0].inference).replace(/\.$/, '')}, rather than selling AI.`,
    decision_maker_name: null, decision_maker_title: null, decision_maker_source: null,
    decision_maker_confidence: 0, recommended_role: 'Owner / Managing Director',
    personalization_facts: [candidate.industry && { type: 'industry', value: candidate.industry }, candidate.city && { type: 'location', value: candidate.city }].filter(Boolean),
    detected_opportunities: opportunities, evidence: signals, last_activity_at: null, last_activity_source: null,
    activity_confidence: 0, activity_state: 'uncertain', last_contact_at: relationship.lastContactAt,
    last_contact_channel: null, last_contact_outcome: null, contact_attempt_count: relationship.contactAttempts,
    last_enriched_at: observedAt, last_qualified_at: observedAt, next_requalification_at: inDays(opportunities.length ? 14 : 30),
    rules_version: 'qualification-rules-v1', model_version: 'deterministic-v1', calculated_at: observedAt,
  };
}

export async function qualifyCandidate(db: SupabaseClient, workspaceId: string, candidate: Candidate) {
  const canonicalKey = String(candidate.canonical_business_key || '');
  const [{ data: existingLead }, { data: suppression }, { count: contactAttempts, data: lastMessage }] = await Promise.all([
    canonicalKey ? db.from('leads').select('id,stage').eq('tenant_id', workspaceId).eq('canonical_business_key', canonicalKey).maybeSingle() : Promise.resolve({ data: null }),
    candidate.public_email ? db.from('lead_suppressions').select('id').eq('workspace_id', workspaceId).eq('normalized_value', String(candidate.public_email).toLowerCase()).maybeSingle() : Promise.resolve({ data: null }),
    db.from('outreach_messages').select('sent_at,channel,status', { count: 'exact' }).eq('workspace_id', workspaceId).eq('candidate_id', String(candidate.id)).order('created_at', { ascending: false }).limit(1),
  ]);
  const relationship: Relationship = suppression ? { state: 'do_not_contact', lastContactAt: null, contactAttempts: 0 }
    : existingLead?.stage === 'customer' ? { state: 'customer', lastContactAt: null, contactAttempts: 0 }
    : (contactAttempts || 0) > 0 ? { state: 'contacted', lastContactAt: lastMessage?.[0]?.sent_at || null, contactAttempts: contactAttempts || 0 }
    : { state: 'new', lastContactAt: null, contactAttempts: 0 };
  const snapshot = buildLeadQualification(candidate, relationship);
  const { data: current } = await db.from('lead_qualification_snapshots').select('id').eq('workspace_id', workspaceId).eq('candidate_id', String(candidate.id)).maybeSingle();
  const payload = { workspace_id: workspaceId, candidate_id: String(candidate.id), ...snapshot, updated_at: nowIso() };
  const result = current ? await db.from('lead_qualification_snapshots').update(payload).eq('id', current.id).eq('workspace_id', workspaceId) : await db.from('lead_qualification_snapshots').insert(payload);
  if (result.error) throw result.error;
  await db.from('lead_signals').delete().eq('workspace_id', workspaceId).eq('candidate_id', String(candidate.id));
  if (snapshot.signals.length) {
    const { error } = await db.from('lead_signals').insert(snapshot.signals.map((signal) => ({ workspace_id: workspaceId, candidate_id: String(candidate.id), ...signal })));
    if (error) throw error;
  }
  return snapshot;
}

/** Re-use the same rules after a new sighting, CRM event, reply, bounce, or
 * scheduled freshness check. It only recalculates intelligence; it never sends. */
export async function requalifyLeadCandidate(db: SupabaseClient, workspaceId: string, candidateId: string) {
  const { data: candidate, error } = await db.from('lead_candidates').select('*')
    .eq('workspace_id', workspaceId).eq('id', candidateId).single();
  if (error) throw error;
  return qualifyCandidate(db, workspaceId, candidate as Candidate);
}
