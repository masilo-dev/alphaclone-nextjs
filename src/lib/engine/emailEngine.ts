import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { eventBus } from "./eventBus";

export type EmailIntent = "INTERESTED" | "PRICING_REQUEST" | "QUESTION" | "NOT_INTERESTED" | "UNSUBSCRIBE";

export interface ClassifiedEmailReply {
  intent: EmailIntent;
  confidence: number;
  extracted_service?: string;
  suggested_action: string;
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

export class EmailEngine {
  private static instance: EmailEngine;

  public static getInstance(): EmailEngine {
    if (!EmailEngine.instance) {
      EmailEngine.instance = new EmailEngine();
    }
    return EmailEngine.instance;
  }

  /**
   * Classify an incoming email reply's intent using pattern matching & keyword heuristics.
   */
  public classifyEmailReply(body: string, subject: string = ""): ClassifiedEmailReply {
    const text = (subject + " " + body).toLowerCase();

    if (text.includes("unsubscribe") || text.includes("remove me") || text.includes("stop emailing") || text.includes("do not contact")) {
      return { intent: "UNSUBSCRIBE", confidence: 0.95, suggested_action: "mark_opt_out" };
    }

    if (text.includes("how much") || text.includes("pricing") || text.includes("quote") || text.includes("cost") || text.includes("rate") || text.includes("proposal")) {
      return { intent: "PRICING_REQUEST", confidence: 0.9, suggested_action: "generate_and_send_quote" };
    }

    if (text.includes("not interested") || text.includes("no thanks") || text.includes("pass on this")) {
      return { intent: "NOT_INTERESTED", confidence: 0.85, suggested_action: "mark_uninterested" };
    }

    if (text.includes("interested") || text.includes("tell me more") || text.includes("let's talk") || text.includes("schedule") || text.includes("call") || text.includes("demo")) {
      return { intent: "INTERESTED", confidence: 0.88, suggested_action: "schedule_discovery_call" };
    }

    return { intent: "QUESTION", confidence: 0.6, suggested_action: "draft_ai_answer" };
  }

  /**
   * Ingest an incoming email reply for a tenant and lead.
   */
  public async ingestIncomingReply(tenantId: string, leadId: string, fromEmail: string, subject: string, body: string): Promise<void> {
    const classification = this.classifyEmailReply(body, subject);
    console.log(`[EmailEngine] Ingested reply from ${fromEmail} (Lead: ${leadId}). Intent: ${classification.intent}`);

    // Emit domain event which wakes workflow engine (cancelling follow-ups & triggering auto-replies)
    await eventBus.emit({
      tenant_id: tenantId,
      event_type: "email.replied",
      aggregate_type: "lead",
      aggregate_id: leadId,
      payload: {
        from_email: fromEmail,
        subject,
        body,
        intent: classification.intent,
        confidence: classification.confidence,
        suggested_action: classification.suggested_action,
      },
    });

    if (classification.intent === "UNSUBSCRIBE") {
      const supabase = getDbClient();
      await supabase.from("leads").update({ status: "opt_out", updated_at: new Date().toISOString() }).eq("id", leadId);
    }
  }
}

export const emailEngine = EmailEngine.getInstance();
