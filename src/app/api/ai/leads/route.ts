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
import { freePlacesService } from '@/services/freePlacesService';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

        let leads: any[] = [];
        let source = 'Verified directory search';
        let provider = 'auto';
        let model = 'auto';


        console.log(`[Lead Gen] Attempting free places search for: ${industry} in ${location}`);
        const { places, error: placesError } = await freePlacesService.searchPlaces(
            `${industry} in ${location}`
        );

        if (!placesError && places && places.length > 0) {
            console.log(`[Lead Gen] Found ${places.length} real leads from free sources (capping at ${capBatch})`);
            leads = places.slice(0, capBatch).map((p) => ({
                id: crypto.randomUUID(),
                ...p,
                estimatedValue: null,
                notes: `Real business found via ${p.source}. Matches "${industry}" in "${location}".`,
            }));
            source = 'Free Places Search';
        } else if (placesError) {
            console.warn(`[Lead Gen] Free places error: ${placesError}. Falling back to AI...`);
        }

        if (leads.length === 0) {
            return NextResponse.json({
                leads: [],
                source: 'Verified directory search',
                provider: 'directory',
                model: null,
                warning: 'No verified businesses matched this search. Broaden the industry or location and try again.',
            });
        }

        if (leads.length > capBatch) {
            leads = leads.slice(0, capBatch);
        }

        if (leads.length > 0) {
            console.log('[Lead Gen] Running AI audit pass...');
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
                const verificationPrompt = `You are a Senior Strategic SDR and Data Scientist Auditor at AlphaClone.
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
1. Never invent, replace, or claim verification of contact details.
2. Pain Points: Suggest 3 hypotheses clearly framed for human review.
3. Outreach Hook: Write a hyper-personalized, non-generic first line for an email (max 20 words).
4. Strategic Strategy: Assign a strategy (ROI_FOCUS, PROBLEM_SOLVER, or CASUAL_INTRO).
5. Value Proposition: A concise 1-sentence reason why AlphaClone's AI automation specifically helps THIS business.

Strict Output JSON:
{
  "enrichedLeads": [
    { 
      "businessName": "Exact Matching Name", 
      "isVerified": false,
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
                                    isVerified: false,
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

        if (leads.length > 0) {
            try {
                const { geocodeAddress } = await import('@/lib/location/geocodeAddress');

                leads = await Promise.all(
                    leads.map(async (lead) => {
                        try {
                            if (lead.location) {
                                const { valid, formattedAddress } = await geocodeAddress(lead.location);
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

        const validatedLeads = leads;

        const finalLeads = validatedLeads.slice(0, capBatch).map((l) => ({
            ...l,
            foundBy: `AlphaClone Senior SDR (${provider})`,
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
            auditor: `AI Data Scientist (${provider})`,
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
