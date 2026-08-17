import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { leadGenEngine } from "./leadGenEngine";
import { socialAutopilot } from "./socialAutopilot";

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

export class ContinuousEvaluator {
  private static instance: ContinuousEvaluator;

  public static getInstance(): ContinuousEvaluator {
    if (!ContinuousEvaluator.instance) {
      ContinuousEvaluator.instance = new ContinuousEvaluator();
    }
    return ContinuousEvaluator.instance;
  }

  /**
   * Run a continuous evaluator cycle for active tenants.
   */
  public async evaluateCycle(): Promise<void> {
    const supabase = getDbClient();
    console.log("[ContinuousEvaluator] Starting continuous evaluation cycle...");

    // 1. Fetch active tenants or default tenant
    const { data: tenants } = await supabase.from("tenants").select("id").limit(10);
    const tenantIds = tenants && tenants.length > 0 ? tenants.map(t => t.id) : ["066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4"];

    for (const tenantId of tenantIds) {
      try {
        // A. Check pipeline replenishment
        await leadGenEngine.checkAndReplenishPipeline(tenantId, 15);

        // B. Publish due scheduled social posts
        await socialAutopilot.syncDueScheduledPosts(tenantId);
      } catch (err: any) {
        console.error(`[ContinuousEvaluator] Error evaluating tenant ${tenantId}:`, err.message);
      }
    }

    console.log("[ContinuousEvaluator] Evaluation cycle complete.");
  }
}

export const continuousEvaluator = ContinuousEvaluator.getInstance();
