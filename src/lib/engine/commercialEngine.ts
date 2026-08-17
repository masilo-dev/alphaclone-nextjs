import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { eventBus } from "./eventBus";
import { policyEngine } from "./policyEngine";

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  base_price: number;
  billing_cycle: "one_time" | "monthly" | "annual";
}

export const DEFAULT_SERVICES: ServiceItem[] = [
  { id: "growth-autopilot", name: "Growth Autopilot Package", description: "Full outbound lead generation, outreach, and social publishing", base_price: 1500, billing_cycle: "monthly" },
  { id: "lead-gen-starter", name: "Lead Gen Starter Pack", description: "Automated scraping and scoring of 500 targeted leads", base_price: 750, billing_cycle: "one_time" },
  { id: "social-management", name: "Autonomous Social Media Publishing", description: "AI content generation and multi-platform posting", base_price: 500, billing_cycle: "monthly" },
];

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

export class CommercialEngine {
  private static instance: CommercialEngine;

  public static getInstance(): CommercialEngine {
    if (!CommercialEngine.instance) {
      CommercialEngine.instance = new CommercialEngine();
    }
    return CommercialEngine.instance;
  }

  /**
   * Auto-generate a Quote for a Lead.
   */
  public async generateQuote(tenantId: string, leadId: string, serviceId: string = "growth-autopilot"): Promise<any> {
    const supabase = getDbClient();
    const service = DEFAULT_SERVICES.find(s => s.id === serviceId) || DEFAULT_SERVICES[0];
    const amount = service.base_price;

    // Policy check first
    const policyResult = await policyEngine.evaluateAction({
      tenant_id: tenantId,
      action_type: "generate_quote",
      risk_level: "MEDIUM",
      value_amount: amount,
      payload: { lead_id: leadId, service_id: serviceId, amount },
    });

    if (!policyResult.allowed) {
      console.log(`[CommercialEngine] Quote generation paused by policy: ${policyResult.reason}`);
      return { status: "pending_approval", approval_id: policyResult.approval_id, reason: policyResult.reason };
    }

    const now = new Date().toISOString();
    const quoteData = {
      tenant_id: tenantId,
      lead_id: leadId,
      title: `Quote for ${service.name}`,
      amount: amount,
      status: "sent",
      valid_until: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: now,
      updated_at: now,
    };

    let quoteId = `quote_${Date.now()}`;
    try {
      const { data, error } = await supabase.from("quotes").insert(quoteData).select().single();
      if (!error && data) quoteId = data.id;
    } catch (e) {}

    console.log(`[CommercialEngine] Generated quote ${quoteId} ($${amount}) for lead ${leadId}`);

    await eventBus.emit({
      tenant_id: tenantId,
      event_type: "quote.generated",
      aggregate_type: "quote",
      aggregate_id: quoteId,
      payload: { lead_id: leadId, amount, service_name: service.name },
    });

    return { status: "sent", quote_id: quoteId, amount };
  }

  /**
   * Generate Contract from accepted Quote.
   */
  public async generateContractFromQuote(tenantId: string, quoteId: string, leadId: string, amount: number): Promise<any> {
    const supabase = getDbClient();
    const now = new Date().toISOString();

    const contractData = {
      tenant_id: tenantId,
      lead_id: leadId,
      quote_id: quoteId,
      title: "Master Services Agreement",
      status: "sent_for_signature",
      value_amount: amount,
      signing_token: `sign_${Date.now()}`,
      created_at: now,
      updated_at: now,
    };

    let contractId = `contract_${Date.now()}`;
    try {
      const { data, error } = await supabase.from("contracts").insert(contractData).select().single();
      if (!error && data) contractId = data.id;
    } catch (e) {}

    console.log(`[CommercialEngine] Generated contract ${contractId} for quote ${quoteId}`);

    await eventBus.emit({
      tenant_id: tenantId,
      event_type: "contract.generated",
      aggregate_type: "contract",
      aggregate_id: contractId,
      payload: { lead_id: leadId, quote_id: quoteId, value_amount: amount },
    });

    return { status: "sent_for_signature", contract_id: contractId };
  }

  /**
   * Onboard client after contract is signed. Converts lead to active client, creates initial invoice.
   */
  public async onboardSignedClient(tenantId: string, contractId: string, leadId: string, amount: number): Promise<void> {
    const supabase = getDbClient();
    const now = new Date().toISOString();

    // 1. Update lead status to won / active client
    await supabase.from("leads").update({ status: "won", updated_at: now }).eq("id", leadId);

    // 2. Create initial invoice
    const invoiceData = {
      tenant_id: tenantId,
      lead_id: leadId,
      contract_id: contractId,
      amount: amount,
      status: "issued",
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: now,
      updated_at: now,
    };

    try {
      await supabase.from("invoices").insert(invoiceData);
    } catch (e) {}

    console.log(`[CommercialEngine] Onboarded signed client for contract ${contractId}! Initial invoice issued ($${amount})`);

    await eventBus.emit({
      tenant_id: tenantId,
      event_type: "client.onboarded",
      aggregate_type: "client",
      aggregate_id: leadId,
      payload: { contract_id: contractId, initial_invoice_amount: amount },
    });
  }
}

export const commercialEngine = CommercialEngine.getInstance();
