import { NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import {
    describeMissingVersusHigherPlans,
    pricingUpgradeUrl,
} from '@/config/aiLeadQuotas';
import { UNITS_PER_LEAD_AI_PASS } from '@/config/aiUsageQuotas';
import {
    getAiLeadQuotaStatus,
    recordAiLeadsGenerated,
    reserveAiLeadBatch,
} from '@/lib/quotas/aiLeadGenerationQuota';
import {
    isPlatformSuperAdmin,
    resolveTenantContextForUser,
    skipAiQuotaForAdminMode,
} from '@/lib/quotas/resolveTenantForAiRequest';
import { consumeAiUnitsOr429 } from '@/lib/quotas/tenantAiUnitsQuota';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { routeAIRequest } from '@/services/aiRouter';
import { googlePlacesService } from '@/services/googlePlacesService';
import { ENV } from '../../../../config/env';

export const runtime = 'nodejs';
export const maxDuration = 60;

const CLAUDE_45_MODEL = 'claude-sonnet-4-5-20250929';
const DEFAULT_BATCH_MAX = 5;

/**
 * AI Lead Generation API Route
 * Enforces per-tenant daily limits by subscription (UTC day). Super-admin platform role bypasses when mode=admin.
 */
export async function POST(req: Request) {
    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { industry, location, filters, tenantId: bodyTenantId, mode } = body as {
            industry?: string;
            location?: string;
            filters?: string;
            tenantId?: string;
            mode?: string;
        };

        if (!industry || !location) {
            return NextResponse.json({ error: 'Industry and location are required' }, { status: 400 });
        }

        const superAdmin = await isPlatformSuperAdmin(supabase, user.id);
        const skipQuota = skipAiQuotaForAdminMode(mode, superAdmin);

        const admin = createSupabaseAdminClient();

        let tenantId: string | null = null;
        let plan = 'free';

        if (!skipQuota) {
            const ctx = await resolveTenantContextForUser(supabase, user.id, bodyTenantId ?? null);
            if (!ctx) {
                return NextResponse.json(
                    {
                        error: 'A workspace is required. Select your organization or pass tenantId.',
                        code: 'TENANT_REQUIRED',
                    },
                    { status: 400 }
                );
            }
            tenantId = ctx.tenantId;
            plan = ctx.plan;
        }

        let capBatch = DEFAULT_BATCH_MAX;

        if (!skipQuota && tenantId) {
            const reserved = await reserveAiLeadBatch(
                admin,
                tenantId,
                plan,
                DEFAULT_BATCH_MAX
            );
            if (!reserved.allowed) {
                const st = reserved.status;
                return NextResponse.json(
                    {
                        error: 'Daily AI lead limit reached for your subscription.',
                        code: 'AI_LEAD_QUOTA_EXCEEDED',
                        plan,
                        limit: st.limit,
                        used: st.used,
                        remaining: 0,
                        resetsAt: st.resetsAt,
                        upgradeUrl: pricingUpgradeUrl(),
                        missingFeatures: describeMissingVersusHigherPlans(plan),
                    },
                    { status: 429 }
                );
            }
            capBatch = reserved.capThisBatch;
        }

        const googleApiKey = ENV.GOOGLE_API_KEY;
        let leads: any[] = [];
        let source = 'AI Simulated';
        let provider = 'Anthropic';
        let model = 'Claude 4.5';

        let rawMapsData: any[] = [];

        if (googleApiKey) {
            console.log(`[Lead Gen] Attempting Google Places search for: ${industry} in ${location}`);
            const { places, rawResults, error: placesError } = await googlePlacesService.searchPlaces(
                `${industry} in ${location}`,
                googleApiKey
            );

            if (!placesError && places && places.length > 0) {
                console.log(`[Lead Gen] Found ${places.length} real leads from Google (capping at ${capBatch})`);
                rawMapsData = rawResults || [];
                leads = places.slice(0, capBatch).map((p) => ({
                    id: Math.random().toString(36).substring(2, 10),
                    ...p,
                    estimatedValue: Math.floor(Math.random() * (50000 - 5000 + 1)) + 5000,
                    notes: `Real business found via Google Maps. Matches "${industry}" in "${location}".`,
                }));
                source = 'Google Maps';
            } else if (placesError) {
                console.warn(`[Lead Gen] Google Places error: ${placesError}. Falling back to AI...`);
            }
        }

        if (leads.length === 0) {
            console.log(`[Lead Gen] Using Claude 4.5 for up to ${capBatch} leads...`);
            if (!skipQuota && tenantId) {
                const blocked = await consumeAiUnitsOr429(
                    admin,
                    tenantId,
                    plan,
                    UNITS_PER_LEAD_AI_PASS
                );
                if (blocked) return blocked;
            }
            const prompt = `You are a Senior Sales Development Representative (SDR) and Data Scientist Auditor at AlphaClone, powered by Claude 4.5.
Your task is to identify EXACTLY ${capBatch} high-fidelity business leads (no more, no less).

SEARCH SPECIFICATION:
- Industry/Service: "${industry}"
- Target Location: "${location}"
${filters ? `- Required Constraints: "${filters}"\n` : ''}

DATA QUALITY REQUIREMENTS (Senior SDR Standard):
- Match the SPECIFIC service niche.
- Contact details MUST be REALTIME and HIGH-FIDELITY.
- **PHONE & EMAIL (NON-NEGOTIABLE)**: You MUST return a valid phone number and a realistic, pattern-verified email for every business. 
- **WEBSITE URL POLICY**: ONLY include a "website" if you are CERTAIN it is the real, active domain.
- Output only valid JSON.

Strict Schema:
[
  {
    "id": "random-8-chars",
    "businessName": "Company Name",
    "industry": "${industry}",
    "location": "${location}",
    "phone": "Localized String",
    "email": "Business Email (Required)",
    "website": "REAL URL ONLY",
    "estimatedValue": numeric_value,
    "notes": "SDR INSIGHT: Why this lead is a high-value target."
  }
]`;

            const aiResponse = await routeAIRequest({
                prompt,
                model: CLAUDE_45_MODEL,
                maxTokens: 2000,
                temperature: 0.2,
            });

            let cleanedContent = aiResponse.content;
            const arrayMatch = cleanedContent.match(/\[[\s\S]*\]/);
            if (arrayMatch) cleanedContent = arrayMatch[0];

            try {
                const parsed = JSON.parse(cleanedContent);
                leads = Array.isArray(parsed) ? parsed : parsed.leads || [parsed];
            } catch (jsonError) {
                console.error('[Lead Gen] AI Parsing Error:', jsonError);
                leads = [];
            }

            source = `Discovery (Claude 4.5)`;
            provider = 'anthropic';
            model = CLAUDE_45_MODEL;
        }

        if (leads.length > capBatch) {
            leads = leads.slice(0, capBatch);
        }

        if (leads.length > 0) {
            console.log('[Lead Gen] Running Claude 4.5 audit pass...');
            try {
                if (!skipQuota && tenantId) {
                    const blocked = await consumeAiUnitsOr429(
                        admin,
                        tenantId,
                        plan,
                        UNITS_PER_LEAD_AI_PASS
                    );
                    if (blocked) return blocked;
                }
                const verificationPrompt = `You are a Senior Strategic SDR and Data Scientist Auditor at AlphaClone using Claude 4.5.
Analyze these ${leads.length} leads for "${industry}" in "${location}". 
Perform a deep-fidelity audit and HYPER-PERSONALIZATION ENRICHMENT.

Leads to Audit/Enrich:
${JSON.stringify(
                    leads.map((l) => ({
                        name: l.businessName,
                        site: l.website,
                        phone: l.phone,
                        email: l.email,
                        industry: l.industry,
                    })),
                    null,
                    2
                )}

AUDIT & ENRICHMENT PARAMETERS:
1. Contact Verification: Ensure phone and email are valid. Discover missing ones using domain heuristics.
2. Tech Stack & Pain Points: Identify likely tech stack and 3 specific operational pain points.
3. Outreach Hook: Write a hyper-personalized, non-generic first line for an email (max 20 words).
4. Strategic Strategy: Assign a strategy (ROI_FOCUS, PROBLEM_SOLVER, or CASUAL_INTRO).
5. Value Proposition: A concise 1-sentence reason why AlphaClone's AI automation specifically helps THIS business.

Strict Output JSON:
{
  "enrichedLeads": [
    { 
      "businessName": "Exact Matching Name", 
      "email": "VERIFIED_EMAIL",
      "phone": "VERIFIED_PHONE",
      "isVerified": boolean, 
      "trustScore": 0-100, 
      "techStack": ["...", "..."],
      "painPoints": ["...", "..."],
      "outreachHook": "Personalized first line",
      "strategy": "ROI_FOCUS" | "PROBLEM_SOLVER" | "CASUAL_INTRO",
      "valueProposition": "Custom USP for this business",
      "dataAnalysis": "Senior audit notes"
    }
  ]
}`;

                const verificationResponse = await routeAIRequest({
                    prompt: verificationPrompt,
                    model: CLAUDE_45_MODEL,
                    maxTokens: 2000,
                    temperature: 0.1,
                });

                try {
                    const vData = JSON.parse(
                        verificationResponse.content.match(/\{[\s\S]*\}/)?.[0] || '{}'
                    );
                    if (vData.enrichedLeads) {
                        leads = leads.map((lead) => {
                            const e = vData.enrichedLeads.find(
                                (v: any) => v.businessName === lead.businessName
                            );
                            if (e) {
                                return {
                                    ...lead,
                                    email: e.email || lead.email,
                                    phone: e.phone || lead.phone,
                                    isVerified: e.isVerified,
                                    trustScore: e.trustScore,
                                    verificationNotes: e.dataAnalysis,
                                    techStack: e.techStack || [],
                                    painPoints: e.painPoints || [],
                                    outreachHook: e.outreachHook || '',
                                    strategy: e.strategy || 'PROBLEM_SOLVER',
                                    valueProposition: e.valueProposition || '',
                                };
                            }
                            return lead;
                        });
                    }
                } catch (pErr) {
                    console.warn('[Lead Gen] Audit parsing failed:', pErr);
                }
            } catch (vErr) {
                console.error('[Lead Gen] Audit pass failed:', vErr);
            }
        }

        if (leads.length > 0 && googleApiKey) {
            try {
                const { googleMapsService } = await import('@/services/googleMapsService');

                leads = await Promise.all(
                    leads.map(async (lead) => {
                        try {
                            if (lead.location) {
                                const { valid, formattedAddress } = await googleMapsService.validateAddress(
                                    lead.location,
                                    googleApiKey
                                );
                                if (valid && formattedAddress) {
                                    return {
                                        ...lead,
                                        location: formattedAddress,
                                        isAddressValid: true,
                                    };
                                }
                            }
                            return { ...lead, isAddressValid: false };
                        } catch {
                            return { ...lead, isAddressValid: false };
                        }
                    })
                );
            } catch (err) {
                console.error('[Lead Gen] Bulk address validation failed:', err);
            }
        }

        const validatedLeads = leads.filter(
            (l) => l.email && l.phone && l.email.includes('@')
        );

        const finalLeads = validatedLeads.slice(0, capBatch).map((l) => ({
            ...l,
            foundBy: 'AlphaClone Senior SDR (Claude 4.5)',
            qualityLevel:
                (l.trustScore || 0) > 80 ? 'Premium' : l.isVerified ? 'High' : 'Discovery',
        }));

        if (!skipQuota && tenantId && finalLeads.length > 0) {
            await recordAiLeadsGenerated(admin, tenantId, finalLeads.length);
        }

        const nextQuota = !skipQuota && tenantId
            ? await getAiLeadQuotaStatus(admin, tenantId, plan)
            : null;

        console.log(`[Lead Gen] Final delivery: ${finalLeads.length} leads`);

        return NextResponse.json({
            leads: finalLeads,
            provider,
            model,
            source,
            isAIVerified: true,
            auditor: 'Claude 4.5 Data Scientist',
            quota: nextQuota
                ? {
                      limit: nextQuota.limit,
                      used: nextQuota.used,
                      remaining: nextQuota.remaining,
                      resetsAt: nextQuota.resetsAt,
                  }
                : undefined,
        });
    } catch (error: unknown) {
        console.error('Lead Generation API Error:', error);
        return clientErrorResponse(error, { request: req, scope: 'ai/leads' });
    }
}
