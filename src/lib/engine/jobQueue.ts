import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

export interface DurableJob {
  id: string;
  tenant_id: string;
  user_id?: string;
  job_type: string;
  payload: Record<string, any>;
  scheduled_at: string;
  status: "pending" | "claimed" | "running" | "completed" | "failed" | "retrying" | "dead_letter" | "cancelled";
  attempts: number;
  max_attempts: number;
  claimed_at?: string;
  completed_at?: string;
  failed_at?: string;
  next_retry_at?: string;
  last_error?: string;
  worker_id?: string;
  idempotency_key?: string;
  created_at: string;
  updated_at: string;
}

export interface EnqueueJobOptions {
  tenant_id: string;
  user_id?: string;
  job_type: string;
  payload: Record<string, any>;
  scheduled_at?: string;
  max_attempts?: number;
  idempotency_key?: string;
}

function getDbClient() {
  const envFiles = [".env.local", ".env.production.local", ".env"];
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    for (const file of envFiles) {
      try {
        const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
        for (const line of content.split("\n")) {
          const [k, ...v] = line.split("=");
          const trimmedK = k.trim();
          const val = v.join("=").trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
          if (!url && (trimmedK === "NEXT_PUBLIC_SUPABASE_URL" || trimmedK === "VITE_SUPABASE_URL")) url = val;
          if (!key && trimmedK === "SUPABASE_SERVICE_ROLE_KEY") key = val;
        }
      } catch (e) {}
    }
  }

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment");
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

export class JobQueueManager {
  private static instance: JobQueueManager;

  public static getInstance(): JobQueueManager {
    if (!JobQueueManager.instance) {
      JobQueueManager.instance = new JobQueueManager();
    }
    return JobQueueManager.instance;
  }

  /**
   * Enqueue a job into the durable background queue.
   * Protects against duplicate submissions via idempotency_key.
   */
  public async enqueueJob(opts: EnqueueJobOptions): Promise<DurableJob> {
    const supabase = getDbClient();
    const scheduledAt = opts.scheduled_at || new Date().toISOString();
    const maxAttempts = opts.max_attempts ?? 5;

    if (opts.idempotency_key) {
      const { data: existing } = await supabase
        .from("background_jobs")
        .select("*")
        .eq("tenant_id", opts.tenant_id)
        .eq("idempotency_key", opts.idempotency_key)
        .maybeSingle();

      if (existing) {
        return existing as DurableJob;
      }
    }

    const newJob = {
      tenant_id: opts.tenant_id,
      user_id: opts.user_id || null,
      job_type: opts.job_type,
      payload: opts.payload || {},
      scheduled_at: scheduledAt,
      status: "pending",
      attempts: 0,
      max_attempts: maxAttempts,
      idempotency_key: opts.idempotency_key || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("background_jobs")
      .insert(newJob)
      .select()
      .single();

    if (error) {
      console.error("[JobQueue] Insert error:", error.message);
      throw new Error(`Failed to enqueue job: ${error.message}`);
    }

    // Forward to agent_tasks durable runtime engine
    try {
      const { createRunForObjective } = await import("@/lib/bonnie/runtime/goalRunService");
      await createRunForObjective({
        tenantId: opts.tenant_id,
        userId: opts.user_id || null,
        objective: `Legacy Job Execution [${opts.job_type}]`,
        executionMode: "autonomous",
        successCriteria: { job_type: opts.job_type, payload: opts.payload },
        seedGraph: true,
      });
    } catch (durableErr) {
      console.warn("[JobQueue] Failed to seed agent_tasks durable run for job:", durableErr);
    }

    return data as DurableJob;
  }

  /**
   * Claim next pending or retrying jobs atomically using FOR UPDATE SKIP LOCKED via RPC or atomic update.
   */
  public async claimNextJobs(workerId: string, batchSize: number = 5): Promise<DurableJob[]> {
    const supabase = getDbClient();
    const now = new Date().toISOString();

    // 1. Try claim_next_durable_job RPC
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("claim_next_durable_job", {
        p_worker_id: workerId,
        p_batch_size: batchSize,
      });

      if (!rpcErr && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
        return rpcData as DurableJob[];
      }
    } catch (e) {
      // RPC might not exist or failed, fallback to atomic query update below
    }

    // 2. Fallback: Select pending/retrying jobs due NOW and claim them atomically
    const { data: candidateJobs } = await supabase
      .from("background_jobs")
      .select("id, attempts")
      .in("status", ["pending", "retrying"])
      .lte("scheduled_at", now)
      .order("scheduled_at", { ascending: true })
      .limit(batchSize);

    if (!candidateJobs || candidateJobs.length === 0) {
      return [];
    }

    const claimedJobs: DurableJob[] = [];
    for (const cand of candidateJobs) {
      const { data: updated, error: updateErr } = await supabase
        .from("background_jobs")
        .update({
          status: "claimed",
          claimed_at: now,
          worker_id: workerId,
          attempts: (cand.attempts || 0) + 1,
          updated_at: now,
        })
        .eq("id", cand.id)
        .in("status", ["pending", "retrying"])
        .select()
        .maybeSingle();

      if (!updateErr && updated) {
        claimedJobs.push(updated as DurableJob);
      }
    }

    return claimedJobs;
  }

  /**
   * Mark job as completed.
   */
  public async completeJob(jobId: string, resultPayload?: Record<string, any>): Promise<void> {
    const supabase = getDbClient();
    const now = new Date().toISOString();

    const updateData: Record<string, any> = {
      status: "completed",
      completed_at: now,
      updated_at: now,
    };

    if (resultPayload) {
      const { data: current } = await supabase
        .from("background_jobs")
        .select("payload")
        .eq("id", jobId)
        .single();
      if (current) {
        updateData.payload = { ...(current.payload || {}), _result: resultPayload };
      }
    }

    await supabase.from("background_jobs").update(updateData).eq("id", jobId);
  }

  /**
   * Handle job failure with exponential backoff retries and dead-letter queue.
   */
  public async failJob(job: DurableJob, errorMessage: string): Promise<void> {
    const supabase = getDbClient();
    const now = new Date();
    const currentAttempts = job.attempts || 1;
    const maxAttempts = job.max_attempts || 5;

    if (currentAttempts >= maxAttempts) {
      // Move to dead letter queue
      await supabase
        .from("background_jobs")
        .update({
          status: "dead_letter",
          failed_at: now.toISOString(),
          last_error: errorMessage,
          updated_at: now.toISOString(),
        })
        .eq("id", job.id);

      console.warn(`[JobQueue] Job ${job.id} moved to DEAD_LETTER after ${currentAttempts} attempts. Error: ${errorMessage}`);
    } else {
      // Calculate exponential backoff delay: 1m, 2m, 4m, 8m...
      const backoffMinutes = Math.pow(2, currentAttempts - 1);
      const nextRetryAt = new Date(now.getTime() + backoffMinutes * 60 * 1000).toISOString();

      await supabase
        .from("background_jobs")
        .update({
          status: "retrying",
          next_retry_at: nextRetryAt,
          last_error: errorMessage,
          updated_at: now.toISOString(),
        })
        .eq("id", job.id);

      console.log(`[JobQueue] Job ${job.id} failed attempt ${currentAttempts}/${maxAttempts}. Next retry at ${nextRetryAt}`);
    }
  }

  /**
   * Cancel pending/retrying jobs matching specific metadata/payload filters.
   * Useful for auto-cancelling email follow-up jobs when an incoming reply arrives.
   */
  public async cancelJobsByPayload(tenantId: string, filterKey: string, filterValue: string): Promise<number> {
    const supabase = getDbClient();
    const { data: pending } = await supabase
      .from("background_jobs")
      .select("id, payload")
      .eq("tenant_id", tenantId)
      .in("status", ["pending", "retrying", "claimed"]);

    if (!pending || pending.length === 0) return 0;

    const toCancelIds: string[] = [];
    for (const job of pending) {
      if (job.payload && job.payload[filterKey] === filterValue) {
        toCancelIds.push(job.id);
      }
    }

    if (toCancelIds.length > 0) {
      await supabase
        .from("background_jobs")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .in("id", toCancelIds);
      console.log(`[JobQueue] Cancelled ${toCancelIds.length} pending jobs matching ${filterKey}=${filterValue}`);
    }

    return toCancelIds.length;
  }
}

export const jobQueue = JobQueueManager.getInstance();
