import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { eventBus } from "./eventBus";

export interface LeadScoreResult {
  score: number;
  fit_rating: "A" | "B" | "C" | "D";
  is_qualified: boolean;
  scoring_breakdown: Record<string, number>;
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

  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { auth: { persistSession: false } });
}

export class LeadGenEngine {
  private static instance: LeadGenEngine;

  public static getInstance(): LeadGenEngine {
    if (!LeadGenEngine.instance) {
      LeadGenEngine.instance = new LeadGenEngine();
    }
    return LeadGenEngine.instance;
  }

  /**
   * Score a lead based on ICP fit rules (company size, title, industry, intent).
   */
  public async scoreLead(leadData: Record<string, any>): Promise<LeadScoreResult> {
    let score = 50; // base score
    const breakdown: Record<string, number> = { base: 50 };

    const title = (leadData.job_title || leadData.title || "").toLowerCase();
    if (title.includes("founder") || title.includes("ceo") || title.includes("owner") || title.includes("director") || title.includes("vp")) {
      score += 25;
      breakdown.decision_maker = 25;
    }

    const industry = (leadData.industry || "").toLowerCase();
    if (industry.includes("tech") || industry.includes("saas") || industry.includes("agency") || industry.includes("consulting")) {
      score += 15;
      breakdown.target_industry = 15;
    }

    if (leadData.email && !leadData.email.includes("@gmail.") && !leadData.email.includes("@yahoo.") && !leadData.email.includes("@hotmail.")) {
      score += 10;
      breakdown.work_email = 10;
    }

    let fitRating: "A" | "B" | "C" | "D" = "C";
    if (score >= 80) fitRating = "A";
    else if (score >= 65) fitRating = "B";
    else if (score >= 50) fitRating = "C";
    else fitRating = "D";

    const isQualified = score >= 65;

    return {
      score,
      fit_rating: fitRating,
      is_qualified: isQualified,
      scoring_breakdown: breakdown,
    };
  }

  /**
   * Evaluates pipeline replenishment status for a tenant. If active leads drop below threshold, triggers lead scraping/generation.
   */
  public async checkAndReplenishPipeline(tenantId: string, minTargetLeads: number = 20): Promise<void> {
    const supabase = getDbClient();

    const { count, error } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("status", ["new", "qualified", "in_outreach"]);

    const activeCount = count || 0;
    console.log(`[LeadGenEngine] Active leads for tenant ${tenantId}: ${activeCount}/${minTargetLeads}`);

    if (activeCount < minTargetLeads) {
      console.log(`[LeadGenEngine] Pipeline replenishment triggered! Generating new leads for tenant ${tenantId}`);
      await eventBus.emit({
        tenant_id: tenantId,
        event_type: "lead_replenishment.requested",
        aggregate_type: "tenant",
        aggregate_id: tenantId,
        payload: { target_count: minTargetLeads - activeCount, current_count: activeCount },
      });
    }
  }
}

export const leadGenEngine = LeadGenEngine.getInstance();
