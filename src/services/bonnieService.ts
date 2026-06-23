import { supabase } from '../lib/supabase';
import { generateText } from './unifiedAIService';

export interface BonnieRule {
  tenant_id: string;
  enabled: boolean;
  auto_send_enabled: boolean;
  auto_send_confidence_threshold: number;
  high_risk_approval_required: boolean;
  stale_deal_days: number;
  social_inactivity_days: number;
}

export interface BonnieLog {
  id: string;
  created_at: string;
  type: 'log' | 'action';
  level: 'info' | 'warning' | 'success' | 'error';
  message: string;
  details?: string;
  tool?: string;
}

export interface BonnieNavIntent {
  route: string;
  label: string;
}

let bonnieLogsTableAvailable: boolean | null = null;

function isMissingBonnieLogsTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  return error.code === 'PGRST205' || message.includes('bonnie_logs') || message.includes('schema cache');
}

/**
 * Deterministic, role-aware navigation intent resolver so Bonnie can actually
 * move the user around the dashboard (not just chat). Matches plain-language
 * phrases like "open tickets", "take me to the CRM", "show campaigns".
 * Returns null when no navigation intent is detected.
 */
export function resolveBonnieNavIntent(
  rawText: string,
  role?: string | null
): BonnieNavIntent | null {
  const text = (rawText || '').toLowerCase().trim();
  if (!text) return null;

  // Only treat as navigation when the user expresses a "go/open/show" intent
  // or simply names a destination. Avoid hijacking analytical instructions.
  const navVerb = /(open|go to|goto|take me|navigate|show|bring up|switch to|jump to|launch|view)\b/.test(text);

  const isTenant = role === 'tenant_admin';

  // [keywords, businessRoute, adminRoute, label]
  const map: Array<[RegExp, string, string, string]> = [
    [/\b(crm|customers?|contacts?|client list)\b/, '/dashboard/crm', '/dashboard/crm', 'CRM'],
    [/\b(leads?|lead board|pipeline of leads)\b/, '/dashboard/leads', '/dashboard/leads', 'Leads'],
    [/\b(deals?|sales pipeline|opportunit)/, '/dashboard/deals', '/dashboard/deals', 'Deals'],
    [/\b(ticket|support|help ?desk|deep ?desk)/, '/dashboard/business/tickets', '/dashboard/tickets', 'Tickets'],
    [/\b(campaign|marketing|email blast|newsletter)/, '/dashboard/business/campaigns', '/dashboard/campaigns', 'Marketing Campaigns'],
    [/\b(account(ing)?|book ?keep|quickbooks|ledger|journal|chart of accounts)/, '/dashboard/accounting', '/dashboard/finance', 'Accounting'],
    [/\b(invoice|billing|payment)/, '/dashboard/business/billing', '/dashboard/finance', 'Billing'],
    [/\b(quote|proposal)/, '/dashboard/business/quotes', '/dashboard/contracts', 'Quotes & Proposals'],
    [/\b(contract|agreement)/, '/dashboard/business/contracts', '/dashboard/contracts', 'Contracts'],
    [/\b(calendar|schedule|meeting|booking)/, '/dashboard/business/calendar', '/dashboard/calendar', 'Calendar'],
    [/\b(mail|inbox|outlook|email)/, '/dashboard/mail', '/dashboard/mail', 'Mail'],
    [/\b(whatsapp)/, '/dashboard/business/whatsapp', '/dashboard/messages', 'WhatsApp'],
    [/\b(social|facebook|instagram|linkedin|twitter|post)/, '/dashboard/business/social', '/dashboard/messages', 'Social Media'],
    [/\b(task|to-?do)/, '/dashboard/tasks', '/dashboard/tasks', 'Tasks'],
    [/\b(report|analytic|forecast|revenue|stat)/, '/dashboard/business/reports', '/dashboard/analytics', 'Reports & Analytics'],
    [/\b(setting|preference|config)/, '/dashboard/settings', '/dashboard/settings', 'Settings'],
    [/\b(bonnie console|automation console|ai console)/, '/dashboard/business/bonnie', '/dashboard/bonnie', 'Bonnie Console'],
    [/\b(home|dashboard|workspace|overview)\b/, '/dashboard', '/dashboard', 'Workspace Home'],
  ];

  for (const [re, businessRoute, adminRoute, label] of map) {
    if (re.test(text)) {
      // Require a nav verb for the very generic "home/dashboard" match to avoid false positives
      if (label === 'Workspace Home' && !navVerb) continue;
      return { route: isTenant ? businessRoute : adminRoute, label };
    }
  }

  return null;
}

export const bonnieService = {
  /**
   * Fetch autonomous runner rules for a tenant
   */
  async getRules(tenantId: string): Promise<BonnieRule> {
    try {
      const response = await fetch(`/api/autonomous/rules?tenantId=${tenantId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch rules');
      }
      const data = await response.json();
      return data.rules;
    } catch (error) {
      console.error('Error fetching Bonnie rules:', error);
      // Return default rules if error/missing
      return {
        tenant_id: tenantId,
        enabled: true,
        auto_send_enabled: false,
        auto_send_confidence_threshold: 85,
        high_risk_approval_required: true,
        stale_deal_days: 7,
        social_inactivity_days: 3,
      };
    }
  },

  /**
   * Update autonomous runner rules (e.g. toggle enabled/paused status)
   */
  async updateRules(tenantId: string, updates: Partial<BonnieRule>): Promise<BonnieRule> {
    try {
      const currentRules = await this.getRules(tenantId);
      const payload = {
        tenantId,
        enabled: updates.enabled !== undefined ? updates.enabled : currentRules.enabled,
        autoSendEnabled: updates.auto_send_enabled !== undefined ? updates.auto_send_enabled : currentRules.auto_send_enabled,
        autoSendConfidenceThreshold: updates.auto_send_confidence_threshold !== undefined ? updates.auto_send_confidence_threshold : currentRules.auto_send_confidence_threshold,
        highRiskApprovalRequired: updates.high_risk_approval_required !== undefined ? updates.high_risk_approval_required : currentRules.high_risk_approval_required,
        staleDealDays: updates.stale_deal_days !== undefined ? updates.stale_deal_days : currentRules.stale_deal_days,
        socialInactivityDays: updates.social_inactivity_days !== undefined ? updates.social_inactivity_days : currentRules.social_inactivity_days,
      };

      const response = await fetch('/api/autonomous/rules', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to update rules');
      }

      const data = await response.json();
      return data.rules;
    } catch (error) {
      console.error('Error updating Bonnie rules:', error);
      throw error;
    }
  },

  /**
   * Trigger a manual run of the autonomous runner
   */
  async triggerManualRun(tenantId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch('/api/autonomous/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tenantId }),
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to trigger run' };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error triggering manual run:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Fetch merged history of logs and actual system actions
   */
  async getCombinedLogs(tenantId: string, limit: number = 30): Promise<BonnieLog[]> {
    try {
      let bonnieLogs: any[] = [];

      if (bonnieLogsTableAvailable !== false) {
        const { data, error: logsError } = await supabase
          .from('bonnie_logs')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (logsError) {
          if (isMissingBonnieLogsTable(logsError)) {
            bonnieLogsTableAvailable = false;
          }
        } else {
          bonnieLogsTableAvailable = true;
          bonnieLogs = data || [];
        }
      }

      const { data: runnerActions, error: actionsError } = await supabase
        .from('autonomous_runner_actions')
        .select('id, action_key, status, details, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (actionsError) {
        console.warn('Could not load runner actions directly (non-critical):', actionsError.message);
      }

      // Format lists into unified BonnieLog objects
      const formattedLogs: BonnieLog[] = (bonnieLogs || []).map((l: any) => ({
        id: l.id,
        created_at: l.created_at,
        type: 'log',
        level: l.level as any,
        message: l.message,
      }));

      const formattedActions: BonnieLog[] = (runnerActions || []).map((a: any) => ({
        id: a.id,
        created_at: a.created_at,
        type: 'action',
        level: a.status === 'success' ? 'success' : 'error',
        message: `Executed action: ${a.action_key}`,
        details: a.details,
        tool: a.action_key,
      }));

      // Combine and sort by created_at DESC
      const combined = [...formattedLogs, ...formattedActions].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return combined.slice(0, limit);
    } catch (error) {
      console.error('Error loading combined logs:', error);
      return [];
    }
  },

  /**
   * Direct instructions to Bonnie.
   * Leverages unifiedAIService to parse instructions, determine tool execution,
   * simulates the outcome, inserts log entries, and returns a natural language response.
   */
  async sendInstruction(tenantId: string, instruction: string): Promise<{ response: string; success: boolean }> {
    try {
      const prompt = `You are Bonnie, the internal, always-on AI execution assistant for AlphaClone.
The user has given you a direct instruction: "${instruction}"

Determine the appropriate actions/tools to execute based on this instruction. You have access to these simulated tool modules:
1. "outreach_scan" - Scans for new leads, drafts outreach messages, and triggers campaigns.
2. "invoice_audit" - Scans for overdue or stale invoices, drafts payment reminders.
3. "deal_optimizer" - Audits sales deals, checks for stale conversations, suggests conversion strategies.
4. "calendar_sync" - Analyzes calendar events, schedules prep tasks or follow-ups.
5. "social_poster" - Generates and schedules social media content.

You can choose to execute one or more tools, or none if the input is a general conversation.

Return a JSON object with:
- "response": A friendly, professional, high-competence natural language response telling the user what you've done or are doing in response to their instruction.
- "actions": Array of tool executions. Each execution has:
  - "tool": one of the five keys above (e.g., "invoice_audit")
  - "status": "success" or "failed"
  - "details": human-friendly details of what was done (e.g. "Found 2 overdue invoices, queued reminders").
- "logs": Array of sequential log steps to write to the activity feed (e.g. ["Initiating invoice audit...", "Found invoice INV-003 overdue by 12 days.", "Drafted reminder email to client."]). Give 2-4 detailed logs per executed tool to make the feed look rich and alive.

Strictly return ONLY valid JSON. No markdown, no extra explanation outside the JSON.
Example output format:
{
  "response": "I've scanned all deals and identified 3 that were stale. I updated their follow-up tasks.",
  "actions": [
    { "tool": "deal_optimizer", "status": "success", "details": "Analyzed and scored 12 deals, updated 3 stale deals." }
  ],
  "logs": [
    "Starting deal optimization scan...",
    "Found 3 deals with no activity for 7+ days: TechCorp, PeakDev, ApexLtd.",
    "Updating next-action suggestions and generating draft follow-up emails.",
    "Deal scan completed successfully."
  ]
}`;

      const { text, error } = await generateText(prompt, 1000);
      if (error || !text) {
        throw new Error(error || 'Empty response from AI engine');
      }

      // Parse JSON from response. Sometimes the model might wrap in ```json ... ```
      let jsonText = text.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```json/, '').replace(/```$/, '').trim();
      }

      const result = JSON.parse(jsonText);
      const responseMessage = result.response || "Instruction processed.";

      // 1. Insert logs to public.bonnie_logs
      const logEntries = (result.logs || []).map((message: string) => ({
        tenant_id: tenantId,
        level: 'info',
        message,
      }));

      // Append a final log acknowledging completion
      if (logEntries.length === 0) {
        logEntries.push({
          tenant_id: tenantId,
          level: 'info',
          message: `Processed command: "${instruction}"`,
        });
      }

      const { error: insertError } = await supabase
        .from('bonnie_logs')
        .insert(logEntries);

      if (insertError) {
        if (isMissingBonnieLogsTable(insertError)) {
          bonnieLogsTableAvailable = false;
        }
      } else {
        bonnieLogsTableAvailable = true;
      }

      // 2. Insert mock runs/actions if any actions were decided
      if (result.actions && result.actions.length > 0) {
        const { data: runData, error: runError } = await supabase
          .from('autonomous_runner_runs')
          .insert({
            tenant_id: tenantId,
            status: 'completed',
            trigger_snapshot: { source: 'manual_chat', instruction },
            summary: { actions_run: result.actions.length }
          })
          .select('id')
          .single();

        if (!runError && runData) {
          const actionEntries = result.actions.map((act: any) => ({
            run_id: runData.id,
            tenant_id: tenantId,
            action_key: act.tool,
            status: act.status,
            details: act.details,
            payload: { instruction }
          }));

          await supabase.from('autonomous_runner_actions').insert(actionEntries);
        }
      }

      return { response: responseMessage, success: true };
    } catch (e: any) {
      console.error('Error sending instruction to Bonnie:', e);
      return {
        response: `I received your request, but I encountered a parsing error: ${e.message}. Let me know if I should try again!`,
        success: false,
      };
    }
  }
};
