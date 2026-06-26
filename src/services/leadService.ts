import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';
import { businessClientService } from './businessClientService';
import { fileUploadService } from './fileUploadService';
import { UnifiedCRMService } from './crm/UnifiedCRMService';
import { assertLeadStageTransition } from '../lib/stageProgression';
import { isTerminalLeadStage, normalizeLeadPipelineStage } from '../lib/crmPipelineStages';
import { intelligenceScoringService } from './intelligence/intelligenceScoringService';

type LeadMetadata = Record<string, any>;

export interface Lead {
    id: string;
    owner_id?: string;
    client_id?: string; // Link to CRM client record
    businessName: string; // mapped from business_name
    industry?: string;
    location?: string;
    phone?: string;
    email?: string;
    website?: string;
    source: string;
    stage: string;
    value?: number;
    notes?: string;
    status?: string; // legacy/UI status
    fb?: string; // extra field often in UI
    created_at?: string;
    outreachMessage?: string;
    outreachStatus?: string;
    isVerified?: boolean;
    trustScore?: number;
    verificationNotes?: string;
    outreachHook?: string;
    strategy?: string;
    techStack?: string[];
    painPoints?: string[];
    valueProposition?: string;
    lat?: number;
    lng?: number;
    isAddressValid?: boolean;
    sdrInsight?: string;
    intelligenceScore?: number;
    intelligenceConfidence?: number;
    intelligenceState?: Record<string, number>;
    intelligenceRecommendations?: string[];
    psychologyProfile?: string[];
    responseProbability?: number;
    hookAnalysis?: string;
    socialLinks?: Record<string, string>;
    metadata?: LeadMetadata;
}

export interface GrowthAgentTarget {
    id: string;
    tenant_id: string;
    name: string;
    industry?: string;
    location?: string;
    filters?: string;
    automated_outreach: boolean;
    last_run_at?: string;
    created_at: string;
    updated_at: string;
}

function coerceMetadata(value: unknown): LeadMetadata {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as LeadMetadata;
    }
    return {};
}

function normalizeSocialLinks(value: unknown): Record<string, string> {
    const raw = coerceMetadata(value);
    return Object.fromEntries(
        Object.entries(raw)
            .filter(([, link]) => typeof link === 'string' && link.trim().length > 0)
            .map(([network, link]) => [network, String(link).trim()])
    );
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const value of values) {
        const item = String(value || '').trim();
        if (!item) continue;
        const key = item.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        normalized.push(item);
    }
    return normalized;
}

function extractDomainFromWebsite(website?: string): string | null {
    const raw = String(website || '').trim();
    if (!raw) return null;
    try {
        const normalized = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
        const host = new URL(normalized).hostname.replace(/^www\./i, '').toLowerCase();
        return host || null;
    } catch {
        return null;
    }
}

function buildTrustScore(input: {
    email?: string;
    phone?: string;
    website?: string;
    socialLinks?: Record<string, string>;
    techStack?: string[];
    verifiedEmailCount?: number;
}): number {
    let score = 0;
    if (input.email) score += 30;
    if (input.phone) score += 25;
    if (input.website) score += 15;
    if (input.socialLinks && Object.keys(input.socialLinks).length > 0) score += 10;
    if (input.techStack && input.techStack.length > 0) score += 10;
    if ((input.verifiedEmailCount || 0) > 0) score += 10;
    return Math.min(100, score);
}

function deriveValueProposition(lead: { industry?: string; website?: string; socialLinks?: Record<string, string>; techStack?: string[] }): string | undefined {
    const industry = String(lead.industry || '').toLowerCase();
    if (industry.includes('restaurant') || industry.includes('cafe') || industry.includes('food')) {
        return 'Improve local discovery, reviews, and direct bookings with a tighter digital funnel.';
    }
    if (industry.includes('law') || industry.includes('account') || industry.includes('consult')) {
        return 'Turn research traffic and referrals into qualified consultations with structured follow-up.';
    }
    if (industry.includes('hvac') || industry.includes('plumb') || industry.includes('electric') || industry.includes('roof')) {
        return 'Capture more high-intent local calls and convert them faster with better intake and follow-up.';
    }
    if (lead.website && lead.socialLinks && Object.keys(lead.socialLinks).length === 0) {
        return 'Strengthen owned web presence with better contact capture and social proof.';
    }
    if ((lead.techStack || []).length > 0) {
        return 'Use the existing digital stack more effectively by tightening conversion and automation gaps.';
    }
    return 'Increase qualified inbound demand with sharper positioning, contact capture, and follow-up.';
}

function normalizeLeadRecord(l: any): Lead {
    const metadata = coerceMetadata(l.metadata);
    return {
        id: l.id,
        owner_id: l.owner_id,
        businessName: l.business_name,
        industry: l.industry,
        location: l.location,
        phone: l.phone,
        email: l.email,
        website: l.website,
        source: l.source,
        stage: normalizeLeadPipelineStage(l.stage),
        value: l.value,
        notes: l.notes,
        created_at: l.created_at,
        client_id: l.client_id,
        isVerified: l.is_verified,
        trustScore: l.trust_score,
        verificationNotes: l.verification_notes,
        outreachHook: l.outreach_hook,
        strategy: l.strategy,
        techStack: l.tech_stack || [],
        painPoints: l.pain_points || [],
        valueProposition: l.value_proposition,
        lat: l.latitude,
        lng: l.longitude,
        status: l.stage === 'lead' ? 'New' : l.stage,
        fb: l.website,
        sdrInsight: l.sdr_insight,
        intelligenceScore: l.intelligence_score,
        intelligenceConfidence: l.intelligence_confidence,
        intelligenceState: l.intelligence_state || undefined,
        intelligenceRecommendations: l.intelligence_recommendations || [],
        psychologyProfile: l.psychology_profile || [],
        responseProbability: metadata.responseProbability || 0,
        hookAnalysis: metadata.hookAnalysis || '',
        socialLinks: normalizeSocialLinks(l.social_links),
        metadata
    };
}

export const leadService = {
    /**
     * Get tenant ID with better error handling
     */
    getTenantId(): string {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) {
                console.error('[LeadService] No tenant ID available');
                throw new Error('No active organization. Please select a workspace.');
            }
            return tenantId;
        } catch (err) {
            console.error('[LeadService] Error getting tenant:', err);
            throw new Error('Unable to determine organization context');
        }
    },

    /**
     * Check if user has valid session and tenant
     */
    async validateSession(): Promise<{ user: any; tenantId: string; error: string | null }> {
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            
            if (authError || !user) {
                // Try to refresh session
                const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
                if (refreshError || !refreshData.user) {
                    return { user: null, tenantId: '', error: 'Session expired. Please sign in again.' };
                }
                return { user: refreshData.user, tenantId: this.getTenantId(), error: null };
            }
            
            const tenantId = this.getTenantId();
            return { user, tenantId, error: null };
        } catch (err: any) {
            return { user: null, tenantId: '', error: err.message || 'Authentication error' };
        }
    },

    /**
     * Get leads for the current user
     */
    async getLeads(): Promise<{ leads: Lead[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('is_test_data', false)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const leads: Lead[] = (data || [])
                .map(normalizeLeadRecord)
                .filter((lead: Lead) => !isTerminalLeadStage(lead.stage));

            return { leads, error: null };
        } catch (err) {
            console.error('Error fetching leads:', err);
            return { leads: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Add a single lead
     */
    async addLead(lead: Partial<Lead>): Promise<{ lead: Lead | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data: userData, error: authError } = await supabase.auth.getUser();

            if (authError || !userData.user) {
                const { data: refreshData } = await supabase.auth.refreshSession();
                if (!refreshData.user) {
                    return { lead: null, error: 'Authentication session expired. Please refresh the page.' };
                }
            }

            const intelligence = intelligenceScoringService.scoreLead({
                industry: lead.industry,
                email: lead.email,
                phone: lead.phone,
                website: lead.website || lead.fb,
                role: lead.notes
            });

            const dbPayload = {
                tenant_id: tenantId,
                owner_id: userData.user?.id || (await supabase.auth.getUser()).data.user?.id,
                business_name: lead.businessName,
                industry: lead.industry,
                location: lead.location,
                phone: lead.phone,
                email: lead.email,
                website: lead.website || lead.fb,
                source: lead.source || 'Manual',
                stage: lead.stage || 'lead',
                value: lead.value || 0,
                notes: lead.notes,
                outreach_message: lead.outreachMessage,
                outreach_status: lead.outreachStatus || 'pending',
                is_verified: lead.isVerified || false,
                trust_score: lead.trustScore || 0,
                verification_notes: lead.verificationNotes,
                outreach_hook: lead.outreachHook,
                strategy: lead.strategy,
                tech_stack: lead.techStack || [],
                pain_points: lead.painPoints || [],
                value_proposition: lead.valueProposition,
                latitude: lead.lat,
                longitude: lead.lng,
                sdr_insight: lead.sdrInsight,
                social_links: lead.socialLinks || {},
                metadata: lead.metadata || {},
                intelligence_score: intelligence.qualifiedProbability,
                intelligence_confidence: intelligence.confidence,
                intelligence_state: intelligence.stateDistribution,
                intelligence_recommendations: intelligence.recommendations,
                psychology_profile: intelligence.psychologyProfile
            };

            const { data, error } = await supabase
                .from('leads')
                .insert(dbPayload)
                .select()
                .single();

            if (error) {
                console.error('LeadService: Insert error', error);
                if (error.code === '42501') return { lead: null, error: 'Permission denied. Please refresh.' };
                throw error;
            }

            const newLead: Lead = normalizeLeadRecord(data);

            // EMIT AUTOMATION EVENT
            const { emitBusinessEvent } = await import('../lib/automation/emit-event');
            await emitBusinessEvent(tenantId, 'lead_created', {
                leadId: newLead.id,
                businessName: newLead.businessName,
                source: newLead.source,
                stage: newLead.stage
            }).catch(err => console.error('Failed to emit lead_created event:', err));

            // SYNC TO EXTERNAL CRM
            UnifiedCRMService.syncLead(newLead).catch((err: any) => console.error('Background CRM Lead Sync Failed:', err));

            return { lead: newLead, error: null };
        } catch (err) {
            return { lead: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Add multiple leads (Bulk Import)
     */
    async addBulkLeads(leads: Partial<Lead>[]): Promise<{ count: number; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data: userData, error: authError } = await supabase.auth.getUser();

            if (authError || !userData.user) {
                const { data: refreshData } = await supabase.auth.refreshSession();
                if (!refreshData.user) {
                    return { count: 0, error: 'Authentication session expired. Please refresh the page.' };
                }
            }

            const ownerId = userData.user?.id || (await supabase.auth.getUser()).data.user?.id;

            const dbPayloads = leads.map((l: any) => {
                const intelligence = intelligenceScoringService.scoreLead({
                    industry: l.industry,
                    email: l.email,
                    phone: l.phone,
                    website: l.website,
                    role: l.notes
                });

                return {
                    tenant_id: tenantId,
                    owner_id: ownerId,
                    business_name: l.businessName,
                    industry: l.industry,
                    location: l.location,
                    phone: l.phone,
                    email: l.email,
                    website: l.website,
                    source: l.source || 'Bulk Upload',
                    stage: 'lead',
                    value: l.value || 0,
                    notes: l.notes,
                    outreach_message: l.outreachMessage,
                    outreach_status: l.outreachStatus || 'pending',
                    is_verified: l.isVerified || false,
                    trust_score: l.trustScore || 0,
                    outreach_hook: l.outreachHook,
                    strategy: l.strategy,
                    tech_stack: l.techStack || [],
                    pain_points: l.painPoints || [],
                    value_proposition: l.valueProposition,
                    latitude: l.lat,
                    longitude: l.lng,
                    sdr_insight: l.sdrInsight,
                    social_links: l.socialLinks || {},
                    metadata: l.metadata || {},
                    intelligence_score: intelligence.qualifiedProbability,
                    intelligence_confidence: intelligence.confidence,
                    intelligence_state: intelligence.stateDistribution,
                    intelligence_recommendations: intelligence.recommendations,
                    psychology_profile: intelligence.psychologyProfile
                };
            });

            const { data, error } = await supabase
                .from('leads')
                .insert(dbPayloads)
                .select();

            if (error) {
                console.error('LeadService: Bulk insert error', error);
                throw error;
            }

            return { count: data?.length || 0, error: null };
        } catch (err) {
            console.error('LeadService: Bulk insert exception', err);
            return { count: 0, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Update a lead
     */
    async updateLead(id: string, updates: Partial<Lead>): Promise<{ error: string | null }> {
        const tenantId = this.getTenantId();

        if (updates.stage) {
            const normalizedStage = normalizeLeadPipelineStage(updates.stage);
            if (isTerminalLeadStage(normalizedStage) && normalizedStage === 'lost') {
                return this.deleteLead(id);
            }

            const { data: existingLead } = await supabase
                .from('leads')
                .select('stage')
                .eq('id', id)
                .eq('tenant_id', tenantId)
                .single();

            if (existingLead) {
                const fromStage = normalizeLeadPipelineStage(existingLead.stage);
                const check = assertLeadStageTransition(fromStage, normalizedStage);
                if (!check.ok) {
                    const message = (check as any).message || 'Invalid stage transition';
                    return { error: message };
                }
            }

            updates = { ...updates, stage: normalizedStage };
        }

        const dbPayload: any = {};
        if (updates.businessName) dbPayload.business_name = updates.businessName;
        if (updates.industry !== undefined) dbPayload.industry = updates.industry;
        if (updates.location !== undefined) dbPayload.location = updates.location;
        if (updates.phone !== undefined) dbPayload.phone = updates.phone;
        if (updates.email !== undefined) dbPayload.email = updates.email;
        if (updates.website !== undefined) dbPayload.website = updates.website;
        if (updates.source !== undefined) dbPayload.source = updates.source;
        if (updates.stage !== undefined) dbPayload.stage = updates.stage;
        if (updates.value !== undefined) dbPayload.value = updates.value;
        if (updates.notes !== undefined) dbPayload.notes = updates.notes;
        if (updates.client_id !== undefined) dbPayload.client_id = updates.client_id;
        if (updates.outreachMessage !== undefined) dbPayload.outreach_message = updates.outreachMessage;
        if (updates.outreachStatus !== undefined) dbPayload.outreach_status = updates.outreachStatus;
        if (updates.isVerified !== undefined) dbPayload.is_verified = updates.isVerified;
        if (updates.trustScore !== undefined) dbPayload.trust_score = updates.trustScore;
        if (updates.verificationNotes !== undefined) dbPayload.verification_notes = updates.verificationNotes;
        if (updates.isAddressValid !== undefined) dbPayload.is_address_valid = updates.isAddressValid;
        if (updates.outreachHook !== undefined) dbPayload.outreach_hook = updates.outreachHook;
        if (updates.strategy !== undefined) dbPayload.strategy = updates.strategy;
        if (updates.techStack !== undefined) dbPayload.tech_stack = updates.techStack;
        if (updates.painPoints !== undefined) dbPayload.pain_points = updates.painPoints;
        if (updates.valueProposition !== undefined) dbPayload.value_proposition = updates.valueProposition;
        if (updates.lat !== undefined) dbPayload.latitude = updates.lat;
        if (updates.lng !== undefined) dbPayload.longitude = updates.lng;
        if (updates.sdrInsight !== undefined) dbPayload.sdr_insight = updates.sdrInsight;
        if (updates.socialLinks !== undefined) dbPayload.social_links = updates.socialLinks;
        if (updates.metadata !== undefined) dbPayload.metadata = updates.metadata;

        const shouldRecomputeIntelligence = [
            updates.industry,
            updates.email,
            updates.phone,
            updates.website,
            updates.notes
        ].some((value) => value !== undefined);

        if (shouldRecomputeIntelligence) {
            const intelligence = intelligenceScoringService.scoreLead({
                industry: updates.industry,
                email: updates.email,
                phone: updates.phone,
                website: updates.website,
                role: updates.notes
            });

            dbPayload.intelligence_score = intelligence.qualifiedProbability;
            dbPayload.intelligence_confidence = intelligence.confidence;
            dbPayload.intelligence_state = intelligence.stateDistribution;
            dbPayload.intelligence_recommendations = intelligence.recommendations;
            dbPayload.psychology_profile = intelligence.psychologyProfile;
        }

        const { error } = await supabase
            .from('leads')
            .update(dbPayload)
            .eq('id', id)
            .eq('tenant_id', tenantId);

        if (!error && updates.stage) {
            // Trigger sync on stage update
            this.getLeadById(id).then(({ lead }) => {
                if (lead) UnifiedCRMService.syncLead(lead).catch((err: any) => console.error('Background CRM Lead Sync Failed:', err));
            });
        }

        return { error: error ? error.message : null };
    },

    /**
     * Get a single lead by ID
     */
    async getLeadById(id: string): Promise<{ lead: Lead | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .eq('id', id)
                .eq('tenant_id', tenantId)
                .single();

            if (error) throw error;

            const lead: Lead = normalizeLeadRecord(data);

            return { lead, error: null };
        } catch (err) {
            return { lead: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Delete a lead
     */
    async deleteLead(id: string): Promise<{ error: string | null }> {
        const tenantId = this.getTenantId();
        await fileUploadService.deleteFileByEntity('lead', id);
        const { error } = await supabase
            .from('leads')
            .delete()
            .eq('id', id)
            .eq('tenant_id', tenantId);
        return { error: error ? error.message : null };
    },

    async bulkDeleteLeads(ids: string[]): Promise<{ error: string | null; count: number }> {
        if (!ids.length) return { error: null, count: 0 };
        const tenantId = this.getTenantId();
        const uniqueIds = [...new Set(ids)];
        try {
            await Promise.all(uniqueIds.map((id) => fileUploadService.deleteFileByEntity('lead', id)));
            const { error } = await supabase
                .from('leads')
                .delete()
                .in('id', uniqueIds)
                .eq('tenant_id', tenantId);
            if (error) throw error;
            return { error: null, count: uniqueIds.length };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Unknown error', count: 0 };
        }
    },

    /**
     * Check if the tenant has reached the lead generation limit
     * Limit: 30 leads per 24-hour window for Free users
     */
    async checkLeadLimit(userRole?: string): Promise<{ allowed: boolean; error: string | null; remaining: number }> {
        try {
            // Super Admin bypass
            if (userRole === 'admin') {
                return { allowed: true, error: null, remaining: 9999 };
            }

            const tenantId = this.getTenantId();
            const { data: tenant, error: tenantError } = await supabase
                .from('tenants')
                .select('subscription_plan')
                .eq('id', tenantId)
                .single();

            if (tenantError) throw tenantError;

            if (tenant.subscription_plan === 'free') {
                const MAX_LEADS_24H = 50;
                const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

                const { count, error } = await supabase
                    .from('leads')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .gte('created_at', twentyFourHoursAgo);

                if (error) throw error;

                const currentCount = count || 0;
                const remaining = Math.max(0, MAX_LEADS_24H - currentCount);

                if (currentCount >= MAX_LEADS_24H) {
                    return {
                        allowed: false,
                        error: `Free plan limit reached: ${MAX_LEADS_24H} new leads per 24 hours (includes saved AI leads). Upgrade for higher limits.`,
                        remaining: 0
                    };
                }
                return { allowed: true, error: null, remaining };
            }

            return { allowed: true, error: null, remaining: 999 };
        } catch (error) {
            console.error('Error checking lead limit:', error);
            return { allowed: false, error: 'Failed to verify usage limits. Please try again.', remaining: 0 };
        }
    },

    /**
     * Get activity history for a lead
     */
    async getLeadActivities(leadId: string): Promise<{ activities: any[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('lead_activities')
                .select('*')
                .eq('lead_id', leadId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { activities: data || [], error: null };
        } catch (err: any) {
            console.error('Error fetching lead activities:', err);
            return { activities: [], error: err.message };
        }
    },

    /**
     * Add a manual activity/note to a lead
     */
    async addLeadActivity(leadId: string, userId: string, type: string, description: string, metadata: any = {}): Promise<{ error: string | null }> {
        try {
            const { error } = await supabase
                .from('lead_activities')
                .insert({
                    lead_id: leadId,
                    user_id: userId,
                    type,
                    description,
                    metadata
                });

            if (error) throw error;
            return { error: null };
        } catch (err: any) {
            console.error('Error adding lead activity:', err);
            return { error: err.message };
        }
    },

    /**
     * Enrich a lead with AI-powered business intelligence
     */
    async enrichLead(id: string, userId: string): Promise<{ notes: string | null; error: string | null }> {
        try {
            const { data: lead, error: getError } = await supabase
                .from('leads')
                .select('*')
                .eq('id', id)
                .single();
            if (getError || !lead) throw new Error(getError?.message || 'Lead not found');

            const existingMetadata = coerceMetadata(lead.metadata);
            const existingSocialLinks = normalizeSocialLinks(lead.social_links);
            const domain = extractDomainFromWebsite(lead.website);
            const discoveredEmails: Array<{ email: string; source: string; confidence: number; verified: boolean }> = [];
            const verificationNotes: string[] = [];
            const socialLinks: Record<string, string> = { ...existingSocialLinks };
            const phoneCandidates = uniqueStrings([lead.phone]);
            const techStack = uniqueStrings(Array.isArray(lead.tech_stack) ? lead.tech_stack : []);
            const enrichmentSources: string[] = [];

            if (lead.website) {
                try {
                    const response = await fetch('/api/scraper/deep-crawl', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: lead.website, usePlaywright: true })
                    });
                    const data = await response.json().catch(() => ({}));
                    if (response.ok && data?.success) {
                        enrichmentSources.push('deep-crawl');
                        uniqueStrings(data.emails || []).forEach((email) => {
                            discoveredEmails.push({ email, source: 'deep-crawl', confidence: 78, verified: false });
                        });
                        if (data.phone) phoneCandidates.push(String(data.phone).trim());
                        Object.assign(socialLinks, normalizeSocialLinks(data.social_links));
                        verificationNotes.push(`Deep crawl found ${Array.isArray(data.emails) ? data.emails.length : 0} emails`);
                    }
                } catch (crawlError) {
                    console.warn('[LeadService] Deep crawl skipped:', crawlError);
                }
            }

            if (domain) {
                try {
                    const response = await fetch('/api/scraper/email-discovery', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            domain,
                            company_name: lead.business_name,
                            methods: ['dns', 'whois', 'github', 'website', 'linkedin'],
                            verify: true
                        })
                    });
                    const data = await response.json().catch(() => ({}));
                    if (response.ok && data?.success) {
                        enrichmentSources.push('email-discovery');
                        for (const item of Array.isArray(data.emails) ? data.emails : []) {
                            const email = String(item?.email || '').trim();
                            if (!email) continue;
                            discoveredEmails.push({
                                email,
                                source: String(item?.source || 'email-discovery'),
                                confidence: Number(item?.confidence || 0),
                                verified: Boolean(item?.verified)
                            });
                        }
                        verificationNotes.push(`Email discovery found ${Array.isArray(data.emails) ? data.emails.length : 0} candidates`);
                    }
                } catch (emailError) {
                    console.warn('[LeadService] Email discovery skipped:', emailError);
                }

                try {
                    const response = await fetch('/api/scraper/affordable', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'enrich_lead',
                            domain,
                            tenant_id: this.getTenantId()
                        })
                    });
                    const data = await response.json().catch(() => ({}));
                    if (response.ok && data?.success) {
                        enrichmentSources.push('affordable-enrichment');
                        uniqueStrings(data?.technology?.technologies || []).forEach((item) => techStack.push(item));
                        for (const item of Array.isArray(data?.emails) ? data.emails : []) {
                            const email = String(item?.email || '').trim();
                            if (!email) continue;
                            discoveredEmails.push({
                                email,
                                source: 'hunter',
                                confidence: Number(item?.score || 0),
                                verified: Boolean(item?.valid)
                            });
                        }
                        if (data?.technology?.company_size) {
                            verificationNotes.push(`BuiltWith company size: ${data.technology.company_size}`);
                        }
                    }
                } catch (affordableError) {
                    console.warn('[LeadService] Affordable enrichment skipped:', affordableError);
                }
            }

            const rankedEmails = discoveredEmails
                .filter((item) => item.email.includes('@'))
                .sort((a, b) => {
                    if (a.verified !== b.verified) return a.verified ? -1 : 1;
                    return b.confidence - a.confidence;
                });
            const primaryEmail = uniqueStrings([lead.email, rankedEmails[0]?.email])[0] || undefined;
            const primaryPhone = uniqueStrings([lead.phone, ...phoneCandidates])[0] || undefined;
            const mergedMetadata = {
                ...existingMetadata,
                enrichment: {
                    ...(coerceMetadata(existingMetadata.enrichment)),
                    lastEnrichedAt: new Date().toISOString(),
                    domain,
                    sources: uniqueStrings([...(Array.isArray(existingMetadata.enrichment?.sources) ? existingMetadata.enrichment.sources : []), ...enrichmentSources]),
                    discoveredEmails: rankedEmails.slice(0, 10),
                    discoveredPhones: uniqueStrings(phoneCandidates).slice(0, 5),
                    socialLinks,
                    techStack: uniqueStrings(techStack).slice(0, 20),
                }
            };

            // Use DeepSeek for AI enrichment if available
            let intelligence: string;
            try {
                const deepSeekKey = process.env.DEEPSEEK_API_KEY || process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
                
                if (deepSeekKey) {
                    const { callDeepSeek } = await import('@/lib/ai/deepseek');
                    const prompt = `Analyze this business lead and provide strategic insights:
Business Name: ${lead.business_name || lead.name}
Industry: ${lead.industry || 'Unknown'}
Location: ${lead.location || lead.city || 'Unknown'}
Website: ${lead.website || 'N/A'}
Known Emails: ${uniqueStrings([lead.email, ...rankedEmails.map((item) => item.email)]).slice(0, 5).join(', ') || 'None'}
Social Links: ${Object.keys(socialLinks).join(', ') || 'None'}
Tech Stack: ${uniqueStrings(techStack).slice(0, 20).join(', ') || 'Unknown'}

Provide:
1. Business overview and likely size
2. Key pain points they might face
3. Recommended outreach angle
4. Technology opportunities
5. Risk factors to consider

Write in plain professional text. No markdown.`;

                    intelligence = await callDeepSeek(prompt, {
                        model: 'deepseek-chat',
                        temperature: 0.5,
                        maxTokens: 1024,
                    });
                } else {
                    const { enrichLeadData } = await import('./unifiedAIService');
                    intelligence = await enrichLeadData({
                        businessName: lead.business_name || lead.name,
                        industry: lead.industry,
                        location: lead.location || lead.city,
                        website: lead.website,
                        knownEmails: uniqueStrings([lead.email, ...rankedEmails.map((item) => item.email)]).slice(0, 5),
                        socialLinks,
                        techStack: uniqueStrings(techStack).slice(0, 20)
                    });
                }
            } catch {
                const { enrichLeadData } = await import('./unifiedAIService');
                intelligence = await enrichLeadData({
                    businessName: lead.business_name || lead.name,
                    industry: lead.industry,
                    location: lead.location || lead.city,
                    website: lead.website,
                    knownEmails: uniqueStrings([lead.email, ...rankedEmails.map((item) => item.email)]).slice(0, 5),
                    socialLinks,
                    techStack: uniqueStrings(techStack).slice(0, 20)
                });
            }

            const updatePayload: Record<string, unknown> = {
                notes: intelligence,
                email: primaryEmail,
                phone: primaryPhone,
                social_links: socialLinks,
                tech_stack: uniqueStrings(techStack).slice(0, 20),
                value_proposition: lead.value_proposition || deriveValueProposition({
                    industry: lead.industry,
                    website: lead.website,
                    socialLinks,
                    techStack
                }),
                is_verified: Boolean(primaryEmail || primaryPhone),
                trust_score: buildTrustScore({
                    email: primaryEmail,
                    phone: primaryPhone,
                    website: lead.website,
                    socialLinks,
                    techStack,
                    verifiedEmailCount: rankedEmails.filter((item) => item.verified).length
                }),
                verification_notes: uniqueStrings([
                    lead.verification_notes,
                    ...verificationNotes,
                    rankedEmails[0] ? `Top email candidate: ${rankedEmails[0].email} via ${rankedEmails[0].source}` : ''
                ]).join(' | '),
                metadata: mergedMetadata,
                sdr_insight: intelligence.split('\n').map((line: string) => line.trim()).find(Boolean) || lead.sdr_insight || null
            };

            let { error: updateError } = await supabase
                .from('leads')
                .update(updatePayload)
                .eq('id', id);

            if (updateError && /social_links/i.test(updateError.message || '')) {
                delete updatePayload.social_links;
                const retry = await supabase.from('leads').update(updatePayload).eq('id', id);
                updateError = retry.error;
            }
            if (updateError && /metadata/i.test(updateError.message || '')) {
                delete updatePayload.metadata;
                const retry = await supabase.from('leads').update(updatePayload).eq('id', id);
                updateError = retry.error;
            }
            if (updateError) throw updateError;

            await this.addLeadActivity(id, userId, 'enrichment', 'Lead enrichment completed', {
                sources: enrichmentSources,
                discoveredEmailCount: rankedEmails.length,
                discoveredPhoneCount: uniqueStrings(phoneCandidates).length,
                socialLinkCount: Object.keys(socialLinks).length,
                techStackCount: uniqueStrings(techStack).length,
            });

            return { notes: intelligence, error: null };
        } catch (err: any) {
            console.error('Error enriching lead:', err);
            return { notes: null, error: err.message };
        }
    },

    /**
     * Get related deals for a lead
     */
    async getRelatedDeals(leadId: string): Promise<{ data: any[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            
            // Get deals where contact was created from this lead
            const { data: deals, error } = await supabase
                .from('deals')
                .select('*')
                .eq('tenant_id', tenantId)
                .or(`metadata->>originalLeadId.eq.${leadId},contact_id.in.(SELECT client_id FROM leads WHERE id = '${leadId}')`)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { data: deals || [], error: null };
        } catch (err: any) {
            console.error('Error fetching related deals:', err);
            return { data: [], error: err.message };
        }
    },

    /**
     * Get all target criteria for the Growth Agent
     */
    async getGrowthAgentTargets(): Promise<{ targets: GrowthAgentTarget[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data, error } = await supabase
                .from('growth_agent_targets')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { targets: data || [], error: null };
        } catch (err: any) {
            console.error('Error fetching growth agent targets:', err);
            return { targets: [], error: err.message };
        }
    },

    /**
     * Define new target criteria for the Growth Agent
     */
    async createGrowthAgentTarget(target: Partial<GrowthAgentTarget>): Promise<{ target: GrowthAgentTarget | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data, error } = await supabase
                .from('growth_agent_targets')
                .insert({
                    tenant_id: tenantId,
                    name: target.name,
                    industry: target.industry,
                    location: target.location,
                    filters: target.filters,
                    automated_outreach: target.automated_outreach || false
                })
                .select()
                .single();

            if (error) throw error;
            return { target: data, error: null };
        } catch (err: any) {
            console.error('Error creating growth agent target:', err);
            return { target: null, error: err.message };
        }
    },

    /**
     * Update existing target criteria
     */
    async updateGrowthAgentTarget(id: string, updates: Partial<GrowthAgentTarget>): Promise<{ error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { error } = await supabase
                .from('growth_agent_targets')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .eq('tenant_id', tenantId);

            if (error) throw error;
            return { error: null };
        } catch (err: any) {
            console.error('Error updating growth agent target:', err);
            return { error: err.message };
        }
    },

    /**
     * Remove target criteria
     */
    async deleteGrowthAgentTarget(id: string): Promise<{ error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { error } = await supabase
                .from('growth_agent_targets')
                .delete()
                .eq('id', id)
                .eq('tenant_id', tenantId);

            if (error) throw error;
            return { error: null };
        } catch (err: any) {
            console.error('Error deleting growth agent target:', err);
            return { error: err.message };
        }
    },

    /**
     * Trigger batch outreach via MCP tool
     */
    async sendBatchOutreach(options: {
        leadIds: string[];
        tone: string;
        customContext: string;
        deliveryProvider?: string;
        source?: 'leads' | 'clients';
    }): Promise<{ success: boolean; error: string | null; sent?: number; total?: number }> {
        try {
            const tenantId = this.getTenantId();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Authentication required');
            if (!options.leadIds.length) throw new Error('No recipients selected');

            type Recipient = { id: string; businessName: string; email?: string; industry?: string; phone?: string; website?: string; location?: string };
            let recipients: Recipient[] = [];

            if (options.source === 'clients') {
                const { clients, error } = await businessClientService.getClients(tenantId, 1, 200);
                if (error) throw new Error(error);
                recipients = (clients || [])
                    .filter((c) => options.leadIds.includes(c.id))
                    .map((c) => ({
                        id: c.id,
                        businessName: c.name,
                        email: c.email,
                        industry: c.industry,
                        phone: c.phone,
                        website: c.website,
                        location: c.location,
                    }));
            } else {
                for (const id of options.leadIds) {
                    const { lead } = await this.getLeadById(id);
                    if (lead) {
                        recipients.push({
                            id: lead.id,
                            businessName: lead.businessName,
                            email: (lead as any).email,
                            industry: lead.industry,
                            phone: lead.phone,
                            website: lead.website,
                            location: lead.location,
                        });
                    }
                }
            }

            const inferEmail = (r: Recipient): string => {
                const direct = String(r.email || '').trim();
                if (direct.includes('@')) return direct.toLowerCase();
                const website = String(r.website || '').trim();
                if (!website) return '';
                try {
                    const url = website.startsWith('http') ? website : `https://${website}`;
                    const host = new URL(url).hostname.replace(/^www\./i, '');
                    return host.includes('.') ? `info@${host}` : '';
                } catch {
                    return '';
                }
            };

            const generationResponse = await fetch('/api/outreach/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leads: recipients.map((r) => {
                        const email = inferEmail(r);
                        return {
                            business_name: r.businessName || 'Unknown',
                            email,
                            phone: r.phone || '',
                            website: r.website || '',
                            address: r.location || '',
                            category: r.industry || '',
                            rating: 0,
                            pitchAngle: email ? 'growth-opportunity' : 'no-email-follow-up',
                            insights: [],
                            score: 75,
                        };
                    }),
                    industry: 'mixed',
                    tone: options.tone,
                    customContext: options.customContext,
                    senderName: user.email || 'AlphaClone Systems',
                    tenantId,
                }),
            });

            const generationData = await generationResponse.json().catch(() => ({}));
            if (!generationResponse.ok || !generationData.success) {
                throw new Error(generationData.error || 'Outreach generation failed');
            }

            const drafts = Array.isArray(generationData.emails) ? generationData.emails : [];
            const provider = options.deliveryProvider || 'zoho';
            const sendResults = await Promise.all(
                drafts.map(async (draft: any) => {
                    const recipient = String(draft.recipientEmail || '').trim();
                    if (!recipient.includes('@')) return { ok: false };
                    const sendResponse = await fetch('/api/outreach/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            tenantId,
                            leadEmail: recipient,
                            leadName: draft.business_name,
                            subject: draft.subject,
                            body: draft.body,
                            pitchAngle: draft.pitchAngle || 'growth-opportunity',
                            industry: 'mixed',
                            score: 75,
                            autoSend: true,
                            consentGranted: true,
                            confidenceScore: 100,
                            deliveryProviders: [provider],
                            preferredProvider: provider,
                            balanceByDailyLimit: false,
                        }),
                    });
                    const sendData = await sendResponse.json().catch(() => ({}));
                    return { ok: sendResponse.ok && sendData.success };
                })
            );

            const sent = sendResults.filter((r) => r.ok).length;
            const now = new Date().toISOString();

            if (options.source !== 'clients') {
                await Promise.all(
                    options.leadIds.map((id) =>
                        this.getLeadById(id).then(({ lead }) => {
                            if (lead) {
                                const metadata = { ...lead.metadata, last_contacted_at: now };
                                return this.updateLead(id, { metadata });
                            }
                        })
                    )
                );
            }

            if (sent === 0) {
                return { success: false, error: 'All outreach sends failed', sent: 0, total: options.leadIds.length };
            }

            return { success: true, error: null, sent, total: options.leadIds.length };
        } catch (err: any) {
            console.error('Error in sendBatchOutreach:', err);
            return { success: false, error: err.message };
        }
    }
};
