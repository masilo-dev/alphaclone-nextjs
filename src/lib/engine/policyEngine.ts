import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

export type AutonomyMode = "COPILOT" | "SEMI_AUTOPILOT" | "FULL_AUTOPILOT";
export type ActionRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface PolicyCheckRequest {
  tenant_id: string;
  user_id?: string;
  action_type: string; // e.g. "send_email", "generate_quote", "publish_social_post", "sign_contract"
  risk_level: ActionRiskLevel;
  value_amount?: number; // e.g. quote amount or transaction value
  payload?: Record<string, any>;
}

export interface PolicyCheckResult {
  allowed: boolean;
  requires_approval: boolean;
  approval_id?: string;
  reason: string;
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

export class PolicyEngine {
  private static instance: PolicyEngine;

  public static getInstance(): PolicyEngine {
    if (!PolicyEngine.instance) {
      PolicyEngine.instance = new PolicyEngine();
    }
    return PolicyEngine.instance;
  }

  /**
   * Evaluate whether an action can execute autonomously or must wait for human approval.
   */
  public async evaluateAction(req: PolicyCheckRequest): Promise<PolicyCheckResult> {
    const supabase = getDbClient();

    // 1. Fetch tenant's policy settings or use defaults
    let mode: AutonomyMode = "SEMI_AUTOPILOT";
    let maxQuoteValueWithoutApproval = 2500;
    let dailyEmailLimit = 50;

    try {
      const { data: policy } = await supabase
        .from("autonomy_policies")
        .select("*")
        .eq("tenant_id", req.tenant_id)
        .maybeSingle();

      if (policy) {
        mode = (policy.mode as AutonomyMode) || mode;
        maxQuoteValueWithoutApproval = policy.max_quote_value_without_approval ?? maxQuoteValueWithoutApproval;
        dailyEmailLimit = policy.daily_email_limit ?? dailyEmailLimit;
      }
    } catch (e) {}

    console.log(`[PolicyEngine] Evaluating action '${req.action_type}' (Risk: ${req.risk_level}) under mode: ${mode}`);

    // COPILOT Mode: Always require approval
    if (mode === "COPILOT") {
      const approvalId = await this.queueHumanApproval(req, "Copilot Mode requires manual approval for all actions.");
      return {
        allowed: false,
        requires_approval: true,
        approval_id: approvalId,
        reason: "Copilot Mode requires founder approval before executing.",
      };
    }

    // FULL_AUTOPILOT Mode: Auto-approve unless CRITICAL risk
    if (mode === "FULL_AUTOPILOT") {
      if (req.risk_level === "CRITICAL") {
        const approvalId = await this.queueHumanApproval(req, "Critical risk actions require founder confirmation.");
        return {
          allowed: false,
          requires_approval: true,
          approval_id: approvalId,
          reason: "Critical risk action requires explicit confirmation.",
        };
      }
      return { allowed: true, requires_approval: false, reason: "Full autopilot approved action." };
    }

    // SEMI_AUTOPILOT Mode: Risk & financial value-based evaluation
    if (req.risk_level === "HIGH" || req.risk_level === "CRITICAL") {
      const approvalId = await this.queueHumanApproval(req, `High/Critical risk action (${req.action_type}) in Semi-Autopilot mode.`);
      return {
        allowed: false,
        requires_approval: true,
        approval_id: approvalId,
        reason: "High/Critical risk action queued for founder review.",
      };
    }

    if (req.value_amount && req.value_amount > maxQuoteValueWithoutApproval) {
      const approvalId = await this.queueHumanApproval(
        req,
        `Financial value ($${req.value_amount}) exceeds semi-autopilot auto-approval threshold ($${maxQuoteValueWithoutApproval}).`
      );
      return {
        allowed: false,
        requires_approval: true,
        approval_id: approvalId,
        reason: `Value $${req.value_amount} exceeds auto-approval threshold ($${maxQuoteValueWithoutApproval}).`,
      };
    }

    return { allowed: true, requires_approval: false, reason: "Semi-autopilot policy passed." };
  }

  private async queueHumanApproval(req: PolicyCheckRequest, reason: string): Promise<string> {
    const supabase = getDbClient();
    const now = new Date().toISOString();

    const approvalData = {
      tenant_id: req.tenant_id,
      action_type: req.action_type,
      payload: req.payload || {},
      status: "pending",
      reason: reason,
      created_at: now,
      updated_at: now,
    };

    try {
      const { data, error } = await supabase
        .from("human_approvals")
        .insert(approvalData)
        .select("id")
        .single();

      if (!error && data) {
        return data.id;
      }
    } catch (e) {
      // Fallback to agent_approvals table
      try {
        const { data } = await supabase
          .from("agent_approvals")
          .insert({
            tenant_id: req.tenant_id,
            proposed_action: { action_type: req.action_type, payload: req.payload },
            action_fingerprint: `${req.action_type}_${Date.now()}`,
            data_version: "1.0",
            status: "pending",
          })
          .select("id")
          .single();
        if (data) return data.id;
      } catch (err) {}
    }

    return `approval_${Date.now()}`;
  }
}

export const policyEngine = PolicyEngine.getInstance();
