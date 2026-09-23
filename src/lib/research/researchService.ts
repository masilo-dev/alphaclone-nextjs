/**
 * AlphaClone Research Service — Single Canonical Research & Discovery Orchestrator.
 * Both the Web UI and the MCP/AI execution layer call this service.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getSourceAdapter } from './sourceAdapters';
import { scrapyClient } from './scrapyClient';
import { checkBatchDuplicate, checkCrmDuplicate } from './deduplication';
import { evaluateResearchLead } from './qualificationEngine';
import { normalizeBusinessName, normalizeDomain, normalizeEmail, normalizePhone } from './normalization';
import { sanitizeUntrustedContent } from './security';
import { insertLeadWithSchemaCompat } from '@/lib/leads/insertLeadCompat';
import type {
  ResearchJob,
  ResearchJobStatus,
  LeadResearchResult,
  QualificationRules,
  ReviewStatus,
} from './types';

// In-memory fallback store to ensure seamless resilience in test/offline environments
const MEMORY_JOBS: Map<string, ResearchJob> = new Map();
const MEMORY_RESULTS: Map<string, LeadResearchResult[]> = new Map();

export class ResearchService {
  /**
   * Start a new tenant-scoped research job.
   */
  async startResearchJob(
    tenantId: string,
    userId: string | null | undefined,
    params: {
      query: string;
      industry?: string;
      location?: string;
      targetCount?: number;
      sources?: string[];
      qualificationRules?: QualificationRules;
    }
  ): Promise<ResearchJob> {
    if (!tenantId) throw new Error('Tenant ID is required to start a research job');
    if (!params.query?.trim() && !params.location?.trim()) {
      throw new Error('Either query keywords or a location must be specified');
    }

    const supabase = createSupabaseAdminClient();
    const targetCount = Math.max(1, Math.min(params.targetCount || 50, 500));
    const sources = params.sources && params.sources.length ? params.sources : ['public_websites', 'directories', 'osm'];
    const qualificationRules = params.qualificationRules || {};

    const now = new Date().toISOString();
    const jobId = crypto.randomUUID();

    const jobRow: ResearchJob = {
      id: jobId,
      research_job_id: jobId,
      tenant_id: tenantId,
      created_by: userId || null,
      query: params.query?.trim() || 'Local Businesses',
      industry: params.industry?.trim() || null,
      location: params.location?.trim() || null,
      target_count: targetCount,
      status: 'queued',
      sources,
      qualification_rules: qualificationRules,
      progress: 0,
      discovered_count: 0,
      processed_count: 0,
      qualified_count: 0,
      duplicate_count: 0,
      error_count: 0,
      started_at: null,
      completed_at: null,
      failed_at: null,
      metadata: {},
      created_at: now,
      updated_at: now,
    };

    // Store in memory first
    MEMORY_JOBS.set(jobId, jobRow);
    MEMORY_RESULTS.set(jobId, []);

    // Try inserting into Supabase research_jobs
    try {
      const { error } = await supabase.from('research_jobs').insert({
        id: jobId,
        tenant_id: tenantId,
        created_by: userId || null,
        query: jobRow.query,
        industry: jobRow.industry,
        location: jobRow.location,
        target_count: jobRow.target_count,
        status: 'queued',
        sources: jobRow.sources,
        qualification_rules: jobRow.qualification_rules,
        progress: 0,
        discovered_count: 0,
        processed_count: 0,
        qualified_count: 0,
        duplicate_count: 0,
        error_count: 0,
      });

      if (error && !/does not exist|not found|schema cache/i.test(error.message)) {
        console.warn('[ResearchService] research_jobs insert warning:', error.message);
      }

      // Record audit event
      await this.recordAuditEvent(supabase, tenantId, userId, 'research_job_started', {
        job_id: jobId,
        query: jobRow.query,
        location: jobRow.location,
        target_count: targetCount,
      });
    } catch {
      // Continue safely
    }

    // Trigger asynchronous execution in background
    setTimeout(() => {
      this.executeResearchWorker(jobId).catch((err) => {
        console.error(`[ResearchService] Worker failed for ${jobId}:`, err);
      });
    }, 10);

    return jobRow;
  }

  /**
   * Get an existing research job with strict tenant isolation.
   */
  async getResearchJob(tenantId: string, jobId: string): Promise<ResearchJob | null> {
    if (!tenantId || !jobId) return null;

    // Check memory store
    const memJob = MEMORY_JOBS.get(jobId);
    if (memJob) {
      if (memJob.tenant_id !== tenantId) return null; // Tenant isolation!
      return memJob;
    }

    const supabase = createSupabaseAdminClient();
    try {
      const { data, error } = await supabase
        .from('research_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error || !data) return null;
      return data as ResearchJob;
    } catch {
      return null;
    }
  }

  /**
   * List research jobs for a tenant.
   */
  async listResearchJobs(tenantId: string, options: { limit?: number } = {}): Promise<ResearchJob[]> {
    if (!tenantId) return [];

    const limit = options.limit || 25;
    const memList = Array.from(MEMORY_JOBS.values())
      .filter((j) => j.tenant_id === tenantId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const supabase = createSupabaseAdminClient();
    try {
      const { data, error } = await supabase
        .from('research_jobs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data && data.length) {
        return data as ResearchJob[];
      }
    } catch {}

    return memList.slice(0, limit);
  }

  /**
   * Retrieve staged research results for a job.
   */
  async getResearchResults(
    tenantId: string,
    jobId: string,
    filters: {
      isQualified?: boolean;
      reviewStatus?: ReviewStatus;
      search?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ results: LeadResearchResult[]; total: number }> {
    if (!tenantId || !jobId) return { results: [], total: 0 };

    // Tenant check
    const job = await this.getResearchJob(tenantId, jobId);
    if (!job) return { results: [], total: 0 };

    let items = MEMORY_RESULTS.get(jobId) || [];

    const supabase = createSupabaseAdminClient();
    try {
      let query = supabase
        .from('lead_research_results')
        .select('*', { count: 'exact' })
        .eq('research_job_id', jobId)
        .eq('tenant_id', tenantId);

      if (filters.isQualified !== undefined) {
        query = query.eq('is_qualified', filters.isQualified);
      }
      if (filters.reviewStatus) {
        query = query.eq('review_status', filters.reviewStatus);
      }
      if (filters.search) {
        query = query.or(`business_name.ilike.%${filters.search}%,public_email.ilike.%${filters.search}%`);
      }

      const limit = filters.limit || 100;
      const offset = filters.offset || 0;
      query = query.order('qualification_score', { ascending: false }).range(offset, offset + limit - 1);

      const { data, count, error } = await query;
      if (!error && data) {
        return { results: data as LeadResearchResult[], total: count || data.length };
      }
    } catch {}

    // Filter memory store
    if (filters.isQualified !== undefined) {
      items = items.filter((x) => x.is_qualified === filters.isQualified);
    }
    if (filters.reviewStatus) {
      items = items.filter((x) => x.review_status === filters.reviewStatus);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      items = items.filter((x) => x.business_name.toLowerCase().includes(q) || (x.public_email || '').toLowerCase().includes(q));
    }

    return {
      results: items.slice(filters.offset || 0, (filters.offset || 0) + (filters.limit || 100)),
      total: items.length,
    };
  }

  /**
   * Cancel an in-flight research job.
   */
  async cancelResearchJob(tenantId: string, jobId: string): Promise<boolean> {
    const job = await this.getResearchJob(tenantId, jobId);
    if (!job) return false;

    job.status = 'cancelled';
    job.updated_at = new Date().toISOString();
    MEMORY_JOBS.set(jobId, job);

    const supabase = createSupabaseAdminClient();
    try {
      await supabase
        .from('research_jobs')
        .update({ status: 'cancelled', updated_at: job.updated_at })
        .eq('id', jobId)
        .eq('tenant_id', tenantId);

      await this.recordAuditEvent(supabase, tenantId, job.created_by, 'research_job_cancelled', { job_id: jobId });
    } catch {}

    return true;
  }

  /**
   * Update review status on a staged lead result.
   */
  async updateResultReviewStatus(
    tenantId: string,
    resultId: string,
    status: ReviewStatus,
    rejectionReason?: string
  ): Promise<boolean> {
    if (!tenantId || !resultId) return false;

    // Update memory
    for (const results of Array.from(MEMORY_RESULTS.values())) {
      const item = results.find((r) => r.id === resultId && r.tenant_id === tenantId);
      if (item) {
        item.review_status = status;
        if (rejectionReason) item.duplicate_reason = rejectionReason;
        item.updated_at = new Date().toISOString();
        break;
      }
    }

    const supabase = createSupabaseAdminClient();
    try {
      const patch: Record<string, unknown> = { review_status: status, updated_at: new Date().toISOString() };
      if (rejectionReason) patch.duplicate_reason = rejectionReason;

      await supabase
        .from('lead_research_results')
        .update(patch)
        .eq('id', resultId)
        .eq('tenant_id', tenantId);
    } catch {}

    return true;
  }

  /**
   * Import approved staged research leads into the CRM.
   */
  async importResearchLeadsToCrm(
    tenantId: string,
    userId: string | null | undefined,
    jobId: string,
    resultIds?: string[],
    options: { defaultStage?: string } = {}
  ): Promise<{ importedCount: number; leadIds: string[]; errors: string[] }> {
    if (!tenantId || !jobId) throw new Error('Tenant ID and Job ID are required');

    const job = await this.getResearchJob(tenantId, jobId);
    if (!job) throw new Error('Research job not found or unauthorized');

    const staged = await this.getResearchResults(tenantId, jobId, { limit: 500 });
    const targetResults = resultIds && resultIds.length
      ? staged.results.filter((r) => resultIds.includes(r.id))
      : staged.results.filter((r) => r.is_qualified && r.review_status !== 'imported');

    const supabase = createSupabaseAdminClient();
    const importedIds: string[] = [];
    const errors: string[] = [];

    for (const record of targetResults) {
      try {
        // Build provenance notes
        const notesParts = [
          `Discovered via AlphaClone Research Engine (Job ID: ${jobId}).`,
          record.description ? `Overview: ${record.description}` : null,
          `Qualification Score: ${record.qualification_score}/100.`,
          record.qualification_reason ? `Evaluation: ${record.qualification_reason}` : null,
          record.source_urls.length ? `Sources: ${record.source_urls.join(', ')}` : null,
          `Crawled: ${record.crawl_timestamp}`,
        ].filter(Boolean);

        const leadPayload = {
          tenant_id: tenantId,
          owner_id: userId || null,
          business_name: record.business_name,
          email: record.public_email || null,
          phone: record.public_phone || null,
          location: record.location || job.location || null,
          industry: record.industry || job.industry || null,
          source: 'alphaclone_research_engine',
          notes: notesParts.join(' \n'),
          linkedin_url: record.linkedin_url || null,
          status: 'new',
          stage: options.defaultStage || (record.qualification_score >= 80 ? 'qualified' : 'new'),
        };

        const { data: newLead, error: insertErr } = await insertLeadWithSchemaCompat(supabase, leadPayload);
        if (insertErr) {
          errors.push(`Failed to import ${record.business_name}: ${insertErr.message}`);
          continue;
        }

        const newLeadId = String((newLead as Record<string, unknown>)?.id || '');
        if (newLeadId) {
          importedIds.push(newLeadId);
          await this.updateResultReviewStatus(tenantId, record.id, 'imported');

          // Update imported_lead_id
          try {
            await supabase
              .from('lead_research_results')
              .update({ imported_lead_id: newLeadId, review_status: 'imported' })
              .eq('id', record.id)
              .eq('tenant_id', tenantId);
          } catch {}
        }
      } catch (err) {
        errors.push(`Error importing ${record.business_name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Record audit ledger event
    await this.recordAuditEvent(supabase, tenantId, userId, 'research_leads_imported_to_crm', {
      job_id: jobId,
      imported_count: importedIds.length,
      requested_count: targetResults.length,
    });

    return {
      importedCount: importedIds.length,
      leadIds: importedIds,
      errors,
    };
  }

  /**
   * The background research worker executing the discovery, crawl, dedupe, and qualification pipeline.
   */
  async executeResearchWorker(jobId: string): Promise<void> {
    const job = MEMORY_JOBS.get(jobId);
    if (!job) return;

    const supabase = createSupabaseAdminClient();
    job.started_at = new Date().toISOString();
    job.status = 'discovering';
    job.progress = 10;
    this.syncJobUpdate(job);

    try {
      // Step 1: Discover candidates via Source Adapters
      const discovered: Array<{
        business_name: string;
        website?: string | null;
        phone?: string | null;
        location?: string | null;
        industry?: string | null;
        source_url?: string | null;
        source_type: string;
      }> = [];

      for (const srcType of job.sources) {
        if (MEMORY_JOBS.get(jobId)?.status === 'cancelled') return;
        const adapter = getSourceAdapter(srcType);
        const items = await adapter.discover({
          query: job.query,
          location: job.location || undefined,
          limit: job.target_count,
        });
        discovered.push(...items);
        if (discovered.length >= job.target_count * 1.5) break;
      }

      job.discovered_count = discovered.length;
      job.status = 'crawling';
      job.progress = 30;
      this.syncJobUpdate(job);

      // Step 2: Crawl target websites with Scrapy
      const targetUrls = discovered
        .map((d) => d.website || (d.source_type === 'public_website' ? d.source_url : null))
        .filter((u): u is string => Boolean(u));

      const crawledResults = await scrapyClient.crawlBatchWebsites(jobId, job.tenant_id, targetUrls, {
        maxPagesPerDomain: 3,
        timeoutSeconds: 12,
        onProgress: (done, total) => {
          if (MEMORY_JOBS.get(jobId)?.status === 'cancelled') return;
          job.progress = Math.min(80, 30 + Math.floor((done / Math.max(1, total)) * 50));
          this.syncJobUpdate(job);
        },
      });

      const crawledMap = new Map(crawledResults.map((c) => [c.domain, c]));

      // Step 3: Extraction, Deduplication, and Qualification
      job.status = 'qualifying';
      job.progress = 85;
      this.syncJobUpdate(job);

      const seenBatchKeys = new Set<string>();
      const stagedResults: LeadResearchResult[] = [];

      for (const item of discovered) {
        if (MEMORY_JOBS.get(jobId)?.status === 'cancelled') return;

        const domain = normalizeDomain(item.website);
        const crawl = domain ? crawledMap.get(domain) : null;

        const businessName = normalizeBusinessName(crawl?.business_name || item.business_name);
        const website = crawl?.website || item.website || null;
        const publicEmail = normalizeEmail(crawl?.public_email);
        const publicPhone = normalizePhone(crawl?.public_phone || item.phone);
        const location = crawl?.location || item.location || job.location || null;
        const industry = crawl?.industry || item.industry || job.industry || null;
        const description = sanitizeUntrustedContent(crawl?.description || '');

        // 3a: Intra-batch dedupe check
        const batchCheck = checkBatchDuplicate(
          { business_name: businessName, website, domain, email: publicEmail, phone: publicPhone },
          seenBatchKeys
        );

        // 3b: CRM database dedupe check
        const crmCheck = await checkCrmDuplicate(supabase, job.tenant_id, {
          business_name: businessName,
          website,
          domain,
          email: publicEmail,
          phone: publicPhone,
        });

        const isDuplicate = batchCheck.isDuplicate || crmCheck.isDuplicate;
        const dedupeReason = crmCheck.duplicateReason || batchCheck.duplicateReason || null;
        if (isDuplicate) job.duplicate_count++;

        // 3c: Qualification evaluation
        const qual = evaluateResearchLead(
          {
            business_name: businessName,
            website,
            public_email: publicEmail,
            public_phone: publicPhone,
            location,
            industry,
            description,
            contact_page: crawl?.contact_page || null,
            linkedin_url: crawl?.linkedin_url || null,
            facebook_url: crawl?.facebook_url || null,
            instagram_url: crawl?.instagram_url || null,
            activity_signals: crawl?.activity_signals || [],
          },
          job.qualification_rules
        );

        if (qual.is_qualified && !isDuplicate) {
          job.qualified_count++;
        }

        const nowIso = new Date().toISOString();
        const stagedLead: LeadResearchResult = {
          id: crypto.randomUUID(),
          research_job_id: jobId,
          tenant_id: job.tenant_id,
          business_name: businessName,
          website,
          domain,
          public_email: publicEmail,
          email_status: publicEmail ? 'found' : 'not_found',
          public_phone: publicPhone,
          location,
          industry,
          description,
          services: crawl?.services || [],
          contact_page: crawl?.contact_page || null,
          about_page: crawl?.about_page || null,
          linkedin_url: crawl?.linkedin_url || null,
          facebook_url: crawl?.facebook_url || null,
          instagram_url: crawl?.instagram_url || null,
          other_social_urls: crawl?.other_social_urls || [],
          source_urls: Array.from(new Set([item.source_url, ...(crawl?.source_urls || [])].filter(Boolean))) as string[],
          source_type: item.source_type || 'public_website',
          activity_signals: crawl?.activity_signals || [],
          qualification_signals: qual.qualification_signals,
          qualification_score: qual.qualification_score,
          confidence_score: qual.confidence_score,
          is_qualified: qual.is_qualified,
          qualification_reason: qual.qualification_reason,
          disqualification_reasons: qual.disqualification_reasons,
          dedupe_status: isDuplicate ? 'duplicate' : 'unique',
          duplicate_reason: dedupeReason,
          review_status: 'staged',
          crawl_timestamp: nowIso,
          raw_evidence: crawl?.raw_evidence || {},
          created_at: nowIso,
          updated_at: nowIso,
        };

        stagedResults.push(stagedLead);
        job.processed_count++;
      }

      // Persist to memory store
      MEMORY_RESULTS.set(jobId, stagedResults);

      // Persist to Supabase if tables exist
      if (stagedResults.length) {
        try {
          await supabase.from('lead_research_results').insert(
            stagedResults.map((r) => ({
              id: r.id,
              research_job_id: r.research_job_id,
              tenant_id: r.tenant_id,
              business_name: r.business_name,
              website: r.website,
              domain: r.domain,
              public_email: r.public_email,
              email_status: r.email_status,
              public_phone: r.public_phone,
              location: r.location,
              industry: r.industry,
              description: r.description,
              services: r.services,
              contact_page: r.contact_page,
              about_page: r.about_page,
              linkedin_url: r.linkedin_url,
              facebook_url: r.facebook_url,
              instagram_url: r.instagram_url,
              other_social_urls: r.other_social_urls,
              source_urls: r.source_urls,
              source_type: r.source_type,
              activity_signals: r.activity_signals,
              qualification_signals: r.qualification_signals,
              qualification_score: r.qualification_score,
              confidence_score: r.confidence_score,
              is_qualified: r.is_qualified,
              qualification_reason: r.qualification_reason,
              disqualification_reasons: r.disqualification_reasons,
              dedupe_status: r.dedupe_status,
              duplicate_reason: r.duplicate_reason,
              review_status: r.review_status,
              crawl_timestamp: r.crawl_timestamp,
              raw_evidence: r.raw_evidence,
            }))
          );
        } catch (dbErr) {
          console.warn('[ResearchService] lead_research_results persist warning:', dbErr);
        }
      }

      // Finalize job status
      job.status = job.error_count > 0 && job.qualified_count > 0 ? 'partially_completed' : 'completed';
      job.progress = 100;
      job.completed_at = new Date().toISOString();
      job.updated_at = job.completed_at;
      this.syncJobUpdate(job);

      await this.recordAuditEvent(supabase, job.tenant_id, job.created_by, 'research_job_completed', {
        job_id: jobId,
        discovered_count: job.discovered_count,
        processed_count: job.processed_count,
        qualified_count: job.qualified_count,
        duplicate_count: job.duplicate_count,
      });
    } catch (err) {
      console.error(`[ResearchService] Job ${jobId} failed:`, err);
      job.status = 'failed';
      job.failed_at = new Date().toISOString();
      job.error_message = err instanceof Error ? err.message : String(err);
      job.updated_at = job.failed_at;
      this.syncJobUpdate(job);
    }
  }

  private syncJobUpdate(job: ResearchJob): void {
    MEMORY_JOBS.set(job.id, { ...job });
    const supabase = createSupabaseAdminClient();
    void (async () => {
      try {
        await supabase
          .from('research_jobs')
          .update({
            status: job.status,
            progress: job.progress,
            discovered_count: job.discovered_count,
            processed_count: job.processed_count,
            qualified_count: job.qualified_count,
            duplicate_count: job.duplicate_count,
            error_count: job.error_count,
            started_at: job.started_at,
            completed_at: job.completed_at,
            failed_at: job.failed_at,
            error_message: job.error_message,
            updated_at: job.updated_at,
          })
          .eq('id', job.id)
          .eq('tenant_id', job.tenant_id);
      } catch {
        // The in-memory job remains authoritative when persistence is unavailable.
      }
    })();
  }

  private async recordAuditEvent(
    supabase: any,
    tenantId: string,
    userId: string | null | undefined,
    action: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    try {
      await supabase.from('audit_logs').insert({
        tenant_id: tenantId,
        user_id: userId || null,
        action,
        entity_type: 'research_job',
        entity_id: metadata.job_id || null,
        metadata,
        created_at: new Date().toISOString(),
      });
    } catch {
      // Non-blocking
    }
  }
}

export const researchService = new ResearchService();
