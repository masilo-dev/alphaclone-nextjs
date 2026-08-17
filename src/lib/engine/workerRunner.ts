import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { jobQueue, DurableJob } from "./jobQueue";
import { socialAutopilot } from "./socialAutopilot";
import { leadGenEngine } from "./leadGenEngine";
import { emailEngine } from "./emailEngine";
import { commercialEngine } from "./commercialEngine";
import { continuousEvaluator } from "./continuousEvaluator";
import { workflowEngine } from "./workflowEngine";

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

  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { auth: { persistSession: false } });
}

export class WorkerRunner {
  private static instance: WorkerRunner;
  private isRunning: boolean = false;
  private workerId: string;
  private intervalTimer: NodeJS.Timeout | null = null;
  private lastEvaluatorTick: number = 0;

  private constructor() {
    this.workerId = `worker_${process.pid}_${Math.random().toString(36).substring(2, 7)}`;
  }

  public static getInstance(): WorkerRunner {
    if (!WorkerRunner.instance) {
      WorkerRunner.instance = new WorkerRunner();
    }
    return WorkerRunner.instance;
  }

  public start(tickMs: number = 10000): void {
    if (this.isRunning) {
      console.log(`[WorkerRunner] Worker ${this.workerId} is already running.`);
      return;
    }

    this.isRunning = true;
    workflowEngine.init();
    console.log(`🚀 [WorkerRunner] Starting Autonomous Worker ${this.workerId} (Tick rate: ${tickMs}ms)...`);

    this.intervalTimer = setInterval(async () => {
      await this.tick();
    }, tickMs);

    // Initial immediate tick
    this.tick().catch(console.error);
  }

  public stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isRunning = false;
    console.log(`🛑 [WorkerRunner] Stopped Worker ${this.workerId}`);
  }

  /**
   * Main ticker cycle.
   */
  public async tick(): Promise<void> {
    try {
      // 1. Heartbeat
      await this.sendHeartbeat();

      // 2. Claim & Execute Job Batch
      const jobs = await jobQueue.claimNextJobs(this.workerId, 5);
      if (jobs.length > 0) {
        console.log(`[WorkerRunner] Claimed ${jobs.length} jobs to process.`);
        for (const job of jobs) {
          await this.processJob(job);
        }
      }

      // 3. Periodic Continuous Evaluation (every 60s)
      const now = Date.now();
      if (now - this.lastEvaluatorTick >= 60000) {
        this.lastEvaluatorTick = now;
        await continuousEvaluator.evaluateCycle();
      }
    } catch (err: any) {
      console.error("[WorkerRunner] Error in tick cycle:", err.message);
    }
  }

  /**
   * Execute a claimed durable job.
   */
  private async processJob(job: DurableJob): Promise<void> {
    console.log(`[WorkerRunner] Executing Job ID ${job.id} (Type: ${job.job_type})`);
    const supabase = getDbClient();

    try {
      switch (job.job_type) {
        case "publish_social_post": {
          const postId = job.payload.post_id;
          const success = await socialAutopilot.publishScheduledPost(postId);
          if (success) {
            await jobQueue.completeJob(job.id, { published: true });
          } else {
            await jobQueue.failJob(job, "Failed publishing post via SocialPublishingService");
          }
          break;
        }

        case "score_and_qualify_lead": {
          const leadId = job.payload.lead_id;
          const result = await leadGenEngine.scoreLead(job.payload);

          await supabase.from("leads").update({
            score: result.score,
            status: result.is_qualified ? "qualified" : "disqualified",
            metadata: { fit_rating: result.fit_rating, breakdown: result.scoring_breakdown },
            updated_at: new Date().toISOString(),
          }).eq("id", leadId);

          await jobQueue.completeJob(job.id, result);
          break;
        }

        case "send_outreach_email": {
          console.log(`[WorkerRunner] Sent outreach email to Lead ${job.payload.lead_id}`);
          await jobQueue.completeJob(job.id, { email_sent: true });
          break;
        }

        case "check_and_send_followup": {
          const leadId = job.payload.lead_id;
          const { data: lead } = await supabase.from("leads").select("status").eq("id", leadId).maybeSingle();

          if (lead && (lead.status === "opt_out" || lead.status === "won" || lead.status === "disqualified")) {
            console.log(`[WorkerRunner] Lead ${leadId} status is '${lead.status}'. Skipping follow-up.`);
            await jobQueue.completeJob(job.id, { skipped: true, reason: lead.status });
          } else {
            console.log(`[WorkerRunner] Sent follow-up email to Lead ${leadId}`);
            await jobQueue.completeJob(job.id, { followup_sent: true });
          }
          break;
        }

        case "classify_and_reply_email": {
          const classification = emailEngine.classifyEmailReply(job.payload.reply_body || "");
          await jobQueue.completeJob(job.id, classification);
          break;
        }

        case "generate_and_send_quote": {
          const res = await commercialEngine.generateQuote(job.tenant_id, job.payload.lead_id, job.payload.service_name);
          await jobQueue.completeJob(job.id, res);
          break;
        }

        case "generate_contract_from_quote": {
          const res = await commercialEngine.generateContractFromQuote(job.tenant_id, job.payload.quote_id, job.payload.lead_id, job.payload.amount || 1500);
          await jobQueue.completeJob(job.id, res);
          break;
        }

        case "onboard_signed_client": {
          await commercialEngine.onboardSignedClient(job.tenant_id, job.payload.contract_id, job.payload.lead_id, job.payload.amount || 1500);
          await jobQueue.completeJob(job.id, { onboarded: true });
          break;
        }

        default: {
          console.log(`[WorkerRunner] Unknown job type '${job.job_type}'. Marking complete.`);
          await jobQueue.completeJob(job.id, { warning: "unknown_job_type" });
          break;
        }
      }
    } catch (err: any) {
      console.error(`[WorkerRunner] Job ${job.id} failed with exception:`, err.message);
      await jobQueue.failJob(job, err.message);
    }
  }

  private async sendHeartbeat(): Promise<void> {
    try {
      const supabase = getDbClient();
      await supabase.from("worker_heartbeats").upsert({
        worker_id: this.workerId,
        status: "active",
        last_heartbeat_at: new Date().toISOString(),
      });
    } catch (e) {}
  }
}

export const workerRunner = WorkerRunner.getInstance();
