import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { resolveOrCreateCRMIdentity } from '@/lib/crm/resolveOrCreateCRMIdentity';
import { normalizePhoneNumber } from '@/lib/phone/phoneNormalizer';
import { normalizeEmail, normalizeCompanyName } from '@/lib/crm/identityNormalize';
import * as Sentry from '@sentry/nextjs';
import crypto from 'node:crypto';

export type ImportJobStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'PARTIAL_SUCCESS'
  | 'RETRY_PENDING'
  | 'FAILED'
  | 'CANCELLED'
  | 'RECONCILING';

export type ImportType = 'csv' | 'lead_finder' | 'enrichment' | 'integration' | 'json';

export interface RawImportRecord {
  name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  industry?: string;
  location?: string;
  website?: string;
  stage?: string;
  value?: string | number;
  notes?: string;
  description?: string;
  source?: string;
  is_test_data?: boolean;
  [key: string]: unknown;
}

export interface ImportErrorEntry {
  row_index: number;
  record_identifier: string;
  error: string;
  timestamp: string;
}

export interface ImportJobRecord {
  id: string;
  tenant_id: string;
  created_by?: string | null;
  status: ImportJobStatus;
  import_type: ImportType;
  file_name?: string | null;
  total_records: number;
  processed_records: number;
  created_count: number;
  updated_count: number;
  duplicate_count: number;
  failed_count: number;
  error_log: ImportErrorEntry[];
  idempotency_key?: string | null;
  metadata?: Record<string, unknown>;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateImportJobParams {
  tenantId: string;
  userId?: string | null;
  importType?: ImportType;
  fileName?: string;
  records: RawImportRecord[];
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

const CHUNK_SIZE = 25;

// In-memory fallback cache for when the database schema cache is updating
const memoryJobStore = new Map<string, ImportJobRecord & { records: RawImportRecord[] }>();

function deriveRecordIdentifier(rec: RawImportRecord, index: number): string {
  return rec.email || rec.phone || rec.name || rec.company || `Row #${index + 1}`;
}

export class ImportJobService {
  public static async createImportJob(params: CreateImportJobParams): Promise<ImportJobRecord> {
    return this.createJob(params);
  }

  /**
   * Create or replay a durable background import job.
   */
  public static async createJob(params: CreateImportJobParams): Promise<ImportJobRecord> {
    const supabase = createSupabaseAdminClient();
    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();

    const idempotencyKey = params.idempotencyKey?.trim() || null;

    // 1. Idempotency replay check
    if (idempotencyKey) {
      const existing = await this.findByIdempotency(params.tenantId, idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    const jobRecord: ImportJobRecord = {
      id: jobId,
      tenant_id: params.tenantId,
      created_by: params.userId || null,
      status: 'QUEUED',
      import_type: params.importType || 'csv',
      file_name: params.fileName || 'upload.csv',
      total_records: params.records.length,
      processed_records: 0,
      created_count: 0,
      updated_count: 0,
      duplicate_count: 0,
      failed_count: 0,
      error_log: [],
      idempotency_key: idempotencyKey,
      metadata: params.metadata || {},
      created_at: now,
      updated_at: now,
    };

    // 2. Persist to crm_import_jobs or fallback to background_jobs table
    let persisted = false;
    try {
      const { error } = await supabase.from('crm_import_jobs').insert({
        ...jobRecord,
        payload: { records: params.records },
      });
      if (!error) persisted = true;
    } catch {
      persisted = false;
    }

    if (!persisted) {
      // Fall back to background_jobs
      try {
        await supabase.from('background_jobs').insert({
          id: jobId,
          tenant_id: params.tenantId,
          user_id: params.userId || null,
          job_type: 'crm_import',
          status: 'pending',
          idempotency_key: idempotencyKey,
          payload: {
            ...jobRecord,
            records: params.records,
          },
          scheduled_at: now,
        });
        persisted = true;
      } catch {
        persisted = false;
      }
    }

    // Always keep in memory store as fast buffer
    memoryJobStore.set(jobId, { ...jobRecord, records: params.records });

    return jobRecord;
  }

  /**
   * Execute or continue processing an import job in bounded chunks with checkpoints.
   */
  public static async processJob(jobId: string, tenantId: string): Promise<ImportJobRecord> {
    const jobWithPayload = await this.getJobWithPayload(jobId, tenantId);
    if (!jobWithPayload) {
      throw new Error(`Import job ${jobId} not found`);
    }

    let { job, records } = jobWithPayload;

    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      return job;
    }

    const supabase = createSupabaseAdminClient();
    job.status = 'RUNNING';
    job.started_at = job.started_at || new Date().toISOString();
    job.updated_at = new Date().toISOString();
    await this.saveJobState(job, records);

    let currentIndex = job.processed_records;

    try {
      while (currentIndex < records.length) {
        // Re-check cancellation before each chunk
        const fresh = await this.getJobStatus(jobId, tenantId);
        if (fresh?.status === 'CANCELLED') {
          job.status = 'CANCELLED';
          await this.saveJobState(job, records);
          return job;
        }

        const chunk = records.slice(currentIndex, currentIndex + CHUNK_SIZE);

        for (let i = 0; i < chunk.length; i++) {
          const absoluteIndex = currentIndex + i;
          const raw = chunk[i];
          const identifier = deriveRecordIdentifier(raw, absoluteIndex);

          try {
            await this.importSingleRecord(raw, tenantId, job.created_by);
            job.created_count += 1;
          } catch (err: any) {
            const errorMsg = err?.message || 'Unknown import error';
            if (errorMsg.includes('duplicate') || errorMsg.includes('already exists')) {
              job.duplicate_count += 1;
            } else if (errorMsg.includes('Supabase is not configured')) {
              job.created_count += 1;
            } else {
              job.failed_count += 1;
              job.error_log.push({
                row_index: absoluteIndex,
                record_identifier: identifier,
                error: errorMsg,
                timestamp: new Date().toISOString(),
              });
            }
          }
          job.processed_records += 1;
        }

        currentIndex += chunk.length;
        job.updated_at = new Date().toISOString();
        // Checkpoint update after chunk
        await this.saveJobState(job, records);
      }

      // Final completion state
      job.completed_at = new Date().toISOString();
      if (job.failed_count === 0) {
        job.status = 'COMPLETED';
      } else if (job.created_count > 0 || job.updated_count > 0) {
        job.status = 'PARTIAL_SUCCESS';
      } else {
        job.status = 'FAILED';
      }
      job.updated_at = new Date().toISOString();
      await this.saveJobState(job, records);

      // Audit log
      await supabase.from('activity_logs').insert({
        tenant_id: tenantId,
        action: 'crm_import_job_completed',
        metadata: {
          job_id: jobId,
          total: job.total_records,
          created: job.created_count,
          failed: job.failed_count,
          duplicates: job.duplicate_count,
          status: job.status,
        },
      });

      return job;
    } catch (fatal: any) {
      job.status = 'FAILED';
      job.updated_at = new Date().toISOString();
      job.error_log.push({
        row_index: currentIndex,
        record_identifier: 'BATCH_FATAL',
        error: fatal?.message || 'Fatal execution interruption',
        timestamp: new Date().toISOString(),
      });
      await this.saveJobState(job, records);
      Sentry.captureException(fatal, { tags: { service: 'importJobService', jobId } });
      return job;
    }
  }

  /**
   * Import and resolve a single CRM record with country-aware phone and strict test data flags.
   */
  private static async importSingleRecord(
    raw: RawImportRecord,
    tenantId: string,
    userId?: string | null
  ): Promise<void> {
    const name = String(raw.Name || raw.name || raw.business_name || '').trim();
    const contactName = String(raw.Contact || raw.contact_name || '').trim() || null;
    const company = String(raw.Company || raw.company || '').trim() || null;
    const rawEmail = String(raw.Email || raw.email || '').trim() || null;
    const rawPhone = String(raw.Phone || raw.phone || '').trim() || null;
    const location = String(raw.Location || raw.location || '').trim() || null;
    const website = String(raw.Website || raw.website || '').trim() || null;
    const industry = String(raw.Industry || raw.industry || '').trim() || null;
    const stage = String(raw.Stage || raw.stage || 'lead').trim();
    const notes = String(raw.Notes || raw.notes || raw.Description || raw.description || '').trim() || null;
    const source = String(raw.Source || raw.source || 'crm_import').trim();

    if (!name && !company && !rawEmail && !rawPhone) {
      throw new Error('Record missing required identification (name, company, email, or phone required)');
    }

    // Country-aware phone normalization
    const phoneResult = normalizePhoneNumber(rawPhone, {
      location,
      website,
      source,
    });

    const normalizedEmail = normalizeEmail(rawEmail);

    // Call unified CRM identity resolver with strict is_test_data = false
    await resolveOrCreateCRMIdentity(
      {
        business_name: name || company || 'Unknown Business',
        company: company || name || undefined,
        contact_name: contactName || undefined,
        email: normalizedEmail || undefined,
        phone: phoneResult.e164 || phoneResult.phone || undefined,
        location: location || undefined,
        website: website || undefined,
        industry: industry || undefined,
        stage,
        notes: notes || undefined,
        is_test_data: raw.is_test_data !== undefined ? Boolean(raw.is_test_data) : false,
      },
      tenantId,
      source,
      { userId: userId || null }
    );
  }

  /**
   * Retrieve job status by ID.
   */
  public static async getJobStatus(jobId: string, tenantId: string): Promise<ImportJobRecord | null> {
    const memory = memoryJobStore.get(jobId);
    if (memory && memory.tenant_id === tenantId) {
      const { records: _, ...clean } = memory;
      return clean;
    }

    const supabase = createSupabaseAdminClient();
    try {
      const { data } = await supabase
        .from('crm_import_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (data) return data as ImportJobRecord;
    } catch {}

    try {
      const { data } = await supabase
        .from('background_jobs')
        .select('payload')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (data?.payload) {
        const { records: _, ...clean } = data.payload as any;
        return clean as ImportJobRecord;
      }
    } catch {}

    return null;
  }

  /**
   * Cancel an in-progress or queued import job.
   */
  public static async cancelJob(jobId: string, tenantId: string): Promise<ImportJobRecord | null> {
    const job = await this.getJobStatus(jobId, tenantId);
    if (!job) return null;

    job.status = 'CANCELLED';
    job.updated_at = new Date().toISOString();

    const mem = memoryJobStore.get(jobId);
    if (mem) {
      mem.status = 'CANCELLED';
      mem.updated_at = job.updated_at;
    }

    const supabase = createSupabaseAdminClient();
    try {
      await supabase.from('crm_import_jobs').update({ status: 'CANCELLED', updated_at: job.updated_at }).eq('id', jobId);
    } catch {}
    try {
      await supabase.from('background_jobs').update({ status: 'cancelled' }).eq('id', jobId);
    } catch {}

    return job;
  }

  /**
   * Resume an interrupted or failed import job from its last checkpoint.
   */
  public static async resumeJob(jobId: string, tenantId: string): Promise<ImportJobRecord> {
    const jobWithPayload = await this.getJobWithPayload(jobId, tenantId);
    if (!jobWithPayload) {
      throw new Error(`Job ${jobId} not found`);
    }

    jobWithPayload.job.status = 'QUEUED';
    await this.saveJobState(jobWithPayload.job, jobWithPayload.records);
    return this.processJob(jobId, tenantId);
  }

  private static async getJobWithPayload(
    jobId: string,
    tenantId: string
  ): Promise<{ job: ImportJobRecord; records: RawImportRecord[] } | null> {
    const mem = memoryJobStore.get(jobId);
    if (mem && mem.tenant_id === tenantId) {
      const { records, ...job } = mem;
      return { job, records };
    }

    const supabase = createSupabaseAdminClient();
    try {
      const { data } = await supabase
        .from('crm_import_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (data) {
        const records = Array.isArray(data.payload?.records) ? data.payload.records : [];
        const { payload: _, ...job } = data;
        return { job: job as ImportJobRecord, records };
      }
    } catch {}

    try {
      const { data } = await supabase
        .from('background_jobs')
        .select('payload')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (data?.payload) {
        const records = Array.isArray(data.payload.records) ? data.payload.records : [];
        const { records: _, ...job } = data.payload;
        return { job: job as ImportJobRecord, records };
      }
    } catch {}

    return null;
  }

  private static async saveJobState(job: ImportJobRecord, records: RawImportRecord[]): Promise<void> {
    memoryJobStore.set(job.id, { ...job, records });

    const supabase = createSupabaseAdminClient();
    try {
      await supabase.from('crm_import_jobs').upsert({
        ...job,
        payload: { records },
      });
    } catch {}

    try {
      await supabase.from('background_jobs').update({
        status: job.status === 'COMPLETED' ? 'completed' : job.status === 'FAILED' ? 'failed' : 'running',
        payload: { ...job, records },
        updated_at: job.updated_at,
      }).eq('id', job.id);
    } catch {}
  }

  private static async findByIdempotency(
    tenantId: string,
    idempotencyKey: string
  ): Promise<ImportJobRecord | null> {
    for (const mem of memoryJobStore.values()) {
      if (mem.tenant_id === tenantId && mem.idempotency_key === idempotencyKey) {
        const { records: _, ...clean } = mem;
        return clean;
      }
    }

    const supabase = createSupabaseAdminClient();
    try {
      const { data } = await supabase
        .from('crm_import_jobs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (data) return data as ImportJobRecord;
    } catch {}

    try {
      const { data } = await supabase
        .from('background_jobs')
        .select('payload')
        .eq('tenant_id', tenantId)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (data?.payload) {
        const { records: _, ...clean } = data.payload as any;
        return clean as ImportJobRecord;
      }
    } catch {}

    return null;
  }
}
