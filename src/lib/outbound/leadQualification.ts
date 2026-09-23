/**
 * AI Lead Qualification Service
 * Structured AI-assisted qualification against ICP definitions.
 * Output is structured data, not free-form text.
 * Distinguishes: confirmed | inferred | unknown
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getDefaultICP, scoreAgainstICP, type ICP } from './icpService';

export type QualificationStatus = 'qualified' | 'unqualified' | 'review_required' | 'disqualified';
export type Confidence = 'high' | 'medium' | 'low';
export type DataQuality = 'confirmed' | 'inferred' | 'unknown';

export interface QualificationInput {
  tenantId: string;
  leadId?: string;
  contactId?: string;
  icpId?: string;
  profile: {
    // Company
    company_name?: string;
    industry?: string;
    location?: string;
    company_size?: number;
    revenue?: number;
    website?: string;
    domain?: string;
    business_type?: string;
    // Contact
    contact_name?: string;
    job_title?: string;
    email?: string;
    // Signals
    social_links?: Record<string, string>;
    technology_stack?: string[];
    pain_points?: string[];
    // Any additional public info
    description?: string;
    notes?: string;
  };
  campaignContext?: string;
}

export interface QualificationResult {
  qualification_score: number;
  qualification_status: QualificationStatus;
  matched_criteria: string[];
  failed_criteria: string[];
  confidence: Confidence;
  reasoning_summary: string;
  recommended_campaign?: string;
  data_quality: Record<string, DataQuality>;
  model_version: string;
  icp_id?: string;
}

const AI_QUALIFICATION_PROMPT = `You are a B2B lead qualification specialist. Your task is to evaluate a prospect against an ICP (Ideal Customer Profile) definition and produce a structured qualification assessment.

Rules:
- Only assess what is actually provided. Do NOT fabricate information.
- Distinguish clearly between confirmed facts, inferred indicators, and unknown data.
- Be conservative with confidence: use 'high' only when multiple signals confirm the assessment.
- Do NOT produce narrative paragraphs — output valid JSON only.
- Return score 0–100 where 100 = perfect ICP match.

Output this exact JSON structure:
{
  "qualification_score": <0-100>,
  "qualification_status": "qualified|unqualified|review_required|disqualified",
  "matched_criteria": ["..."],
  "failed_criteria": ["..."],
  "confidence": "high|medium|low",
  "reasoning_summary": "<2-3 sentences max>",
  "recommended_campaign": "<campaign type or null>",
  "data_quality": {
    "industry": "confirmed|inferred|unknown",
    "location": "confirmed|inferred|unknown",
    "company_size": "confirmed|inferred|unknown",
    "job_title": "confirmed|inferred|unknown",
    "revenue": "confirmed|inferred|unknown"
  }
}`;

export async function qualifyLead(
  input: QualificationInput,
  userId?: string
): Promise<QualificationResult & { id: string }> {
  const admin = createSupabaseAdminClient();

  // Resolve ICP
  let icp: ICP | null = null;
  if (input.icpId) {
    const { data } = await admin
      .from('outbound_icps')
      .select('*')
      .eq('tenant_id', input.tenantId)
      .eq('id', input.icpId)
      .is('deleted_at', null)
      .maybeSingle();
    icp = data as ICP | null;
  }
  if (!icp) {
    icp = await getDefaultICP(input.tenantId);
  }

  // Quick rule-based pre-score (pure function, fast)
  const preScore = icp
    ? scoreAgainstICP(icp, {
        industry: input.profile.industry,
        location: input.profile.location,
        company_size: input.profile.company_size,
        revenue: input.profile.revenue,
        job_title: input.profile.job_title,
        website: input.profile.website,
        social_links: input.profile.social_links,
        pain_points: input.profile.pain_points,
        technology_stack: input.profile.technology_stack,
        domain: input.profile.domain,
        business_type: input.profile.business_type,
      })
    : null;

  // If excluded by ICP rules — skip AI call
  if (preScore?.excluded) {
    const result: QualificationResult = {
      qualification_score: 0,
      qualification_status: 'disqualified',
      matched_criteria: [],
      failed_criteria: preScore.failed,
      confidence: 'high',
      reasoning_summary: 'Prospect matches ICP exclusion criteria and has been disqualified.',
      recommended_campaign: undefined,
      data_quality: buildDataQualityMap(input.profile),
      model_version: 'rule-v1',
      icp_id: icp?.id,
    };
    const id = await persistQualification(admin, input, result);
    return { ...result, id };
  }

  // AI qualification
  let result: QualificationResult;
  try {
    result = await callAIQualification(input, icp, preScore);
  } catch (err) {
    // Fallback to rule-based if AI unavailable
    result = buildRuleBasedResult(input, icp, preScore);
  }

  const id = await persistQualification(admin, input, result, userId);
  return { ...result, id };
}

async function callAIQualification(
  input: QualificationInput,
  icp: ICP | null,
  preScore: ReturnType<typeof scoreAgainstICP> | null
): Promise<QualificationResult> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
  });

  const contextParts = [
    `Prospect profile:`,
    `- Company: ${input.profile.company_name || 'unknown'}`,
    `- Industry: ${input.profile.industry || 'unknown'}`,
    `- Location: ${input.profile.location || 'unknown'}`,
    `- Company size: ${input.profile.company_size ?? 'unknown'}`,
    `- Revenue: ${input.profile.revenue ? `$${input.profile.revenue.toLocaleString()}` : 'unknown'}`,
    `- Website: ${input.profile.website || 'none'}`,
    `- Job title: ${input.profile.job_title || 'unknown'}`,
    `- Business type: ${input.profile.business_type || 'unknown'}`,
    `- Technology stack: ${input.profile.technology_stack?.join(', ') || 'unknown'}`,
    `- Pain points: ${input.profile.pain_points?.join(', ') || 'none identified'}`,
    `- Description: ${input.profile.description || 'none'}`,
    `- Notes: ${input.profile.notes || 'none'}`,
    '',
    icp
      ? [
          `ICP Definition: ${icp.name}`,
          `- Target industries: ${icp.industries?.join(', ') || 'any'}`,
          `- Target locations: ${icp.locations?.join(', ') || 'any'}`,
          `- Company size: ${icp.company_size_min ?? ''}–${icp.company_size_max ?? ''} employees`,
          `- Target job titles: ${icp.job_titles?.join(', ') || 'any'}`,
          `- Pain points: ${icp.pain_points?.join(', ') || 'any'}`,
          `- Technology signals: ${icp.technology_signals?.join(', ') || 'any'}`,
          `- Excluded industries: ${icp.excluded_industries?.join(', ') || 'none'}`,
        ].join('\n')
      : 'No ICP defined — assess general B2B fit.',
    '',
    input.campaignContext ? `Campaign context: ${input.campaignContext}` : '',
    preScore ? `Rule-based pre-score: ${preScore.score}/100` : '',
  ].filter(Boolean).join('\n');

  const prompt = `${AI_QUALIFICATION_PROMPT}\n\n${contextParts}`;
  const response = await model.generateContent(prompt);
  const text = response.response.text();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`AI returned invalid JSON: ${text.slice(0, 200)}`);
  }

  return {
    qualification_score: clamp(Number(parsed.qualification_score ?? 0), 0, 100),
    qualification_status: validateStatus(String(parsed.qualification_status || 'review_required')),
    matched_criteria: asStringArray(parsed.matched_criteria),
    failed_criteria: asStringArray(parsed.failed_criteria),
    confidence: validateConfidence(String(parsed.confidence || 'low')),
    reasoning_summary: String(parsed.reasoning_summary || '').slice(0, 500),
    recommended_campaign: parsed.recommended_campaign ? String(parsed.recommended_campaign) : undefined,
    data_quality: (parsed.data_quality || {}) as Record<string, DataQuality>,
    model_version: 'gemini-2.0-flash',
    icp_id: icp?.id,
  };
}

function buildRuleBasedResult(
  input: QualificationInput,
  icp: ICP | null,
  preScore: ReturnType<typeof scoreAgainstICP> | null
): QualificationResult {
  const score = preScore?.score ?? 50;
  const status: QualificationStatus =
    score >= 70 ? 'qualified' : score >= 40 ? 'review_required' : 'unqualified';
  return {
    qualification_score: score,
    qualification_status: status,
    matched_criteria: preScore?.matched || [],
    failed_criteria: preScore?.failed || [],
    confidence: 'low',
    reasoning_summary: `Rule-based assessment: score ${score}/100. AI qualification unavailable.`,
    recommended_campaign: undefined,
    data_quality: buildDataQualityMap(input.profile),
    model_version: 'rule-v1',
    icp_id: icp?.id,
  };
}

async function persistQualification(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  input: QualificationInput,
  result: QualificationResult,
  userId?: string
): Promise<string> {
  const { data, error } = await admin
    .from('outbound_lead_qualifications')
    .insert({
      tenant_id: input.tenantId,
      lead_id: input.leadId || null,
      contact_id: input.contactId || null,
      icp_id: result.icp_id || null,
      qualification_score: result.qualification_score,
      qualification_status: result.qualification_status,
      matched_criteria: result.matched_criteria,
      failed_criteria: result.failed_criteria,
      confidence: result.confidence,
      reasoning_summary: result.reasoning_summary,
      recommended_campaign: result.recommended_campaign || null,
      data_quality: result.data_quality,
      qualification_method: result.model_version.startsWith('rule') ? 'rule' : 'ai',
      model_version: result.model_version,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function overrideQualification(
  tenantId: string,
  qualificationId: string,
  userId: string,
  newStatus: QualificationStatus,
  reason: string
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('outbound_lead_qualifications')
    .update({
      qualification_status: newStatus,
      overridden_by: userId,
      override_reason: reason,
      overridden_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', qualificationId);
  if (error) throw error;
}

export async function getLatestQualification(
  tenantId: string,
  options: { leadId?: string; contactId?: string }
): Promise<(QualificationResult & { id: string }) | null> {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from('outbound_lead_qualifications')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (options.leadId) query = query.eq('lead_id', options.leadId);
  else if (options.contactId) query = query.eq('contact_id', options.contactId);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    qualification_score: data.qualification_score,
    qualification_status: data.qualification_status as QualificationStatus,
    matched_criteria: data.matched_criteria || [],
    failed_criteria: data.failed_criteria || [],
    confidence: data.confidence as Confidence,
    reasoning_summary: data.reasoning_summary || '',
    recommended_campaign: data.recommended_campaign || undefined,
    data_quality: data.data_quality || {},
    model_version: data.model_version || 'unknown',
    icp_id: data.icp_id || undefined,
  };
}

// ── Helpers ──────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, isNaN(n) ? min : n));
}

function validateStatus(s: string): QualificationStatus {
  const valid: QualificationStatus[] = ['qualified', 'unqualified', 'review_required', 'disqualified'];
  return valid.includes(s as QualificationStatus) ? (s as QualificationStatus) : 'review_required';
}

function validateConfidence(s: string): Confidence {
  return s === 'high' || s === 'medium' || s === 'low' ? s : 'low';
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  return [];
}

function buildDataQualityMap(
  profile: QualificationInput['profile']
): Record<string, DataQuality> {
  const map: Record<string, DataQuality> = {};
  const fields = ['industry', 'location', 'company_size', 'job_title', 'revenue', 'website'] as const;
  for (const field of fields) {
    const val = (profile as Record<string, unknown>)[field];
    map[field] = val !== undefined && val !== null && val !== '' ? 'confirmed' : 'unknown';
  }
  return map;
}
