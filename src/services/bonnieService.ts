import { supabase } from '../lib/supabase';

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
export interface BonnieToolExecuted {
  tool: string;
  success: boolean;
  summary: string;
  approvalRequired?: boolean;
  approvalId?: string;
  riskClass?: string;
  preview?: { target?: string; draft?: string };
}

export interface BonniePendingApprovalResponse {
  approvalId: string;
  tool: string;
  riskClass?: string;
  preview?: { target?: string; draft?: string };
  summary?: string;
}

export interface BonnieInstructionResult {
  response: string;
  success: boolean;
  toolsExecuted?: BonnieToolExecuted[];
  pendingApproval?: BonniePendingApprovalResponse | null;
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
   * Direct instructions to Bonnie — full agentic loop via DeepSeek + real tool execution.
   */
  async sendInstruction(
    tenantId: string,
    instruction: string,
    history?: Array<{ role: 'user' | 'assistant'; content: string }>,
    options?: { pathname?: string; moduleContext?: string }
  ): Promise<BonnieInstructionResult> {
    try {
      const response = await fetch('/api/bonnie/instruct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          instruction,
          history,
          pathname: options?.pathname,
          moduleContext: options?.moduleContext,
        }),
      });

      const raw = await response.text();
      let data: Record<string, unknown> = {};
      if (raw.trim()) {
        try {
          data = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return {
            response: response.ok
              ? 'Bonnie returned an invalid response. Please try again.'
              : `Bonnie error (${response.status}). The server may be busy — try a shorter message.`,
            success: false,
          };
        }
      }

      if (!response.ok) {
        return {
          response: String(data.error || `Bonnie could not process that instruction (${response.status}).`),
          success: false,
        };
      }

      return {
        response: String(data.response || 'Instruction processed.'),
        success: Boolean(data.success),
        toolsExecuted: data.toolsExecuted as BonnieToolExecuted[] | undefined,
        pendingApproval: (data.pendingApproval as BonniePendingApprovalResponse | null) || null,
      };
    } catch (e: any) {
      console.error('Error sending instruction to Bonnie:', e);
      return {
        response: `Bonnie hit a connection error: ${e.message}. Check your network and try again.`,
        success: false,
      };
    }
  },

  async streamInstruction(
    tenantId: string,
    instruction: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> | undefined,
    options: { pathname?: string; moduleContext?: string; onToken?: (token: string) => void; onPhase?: (phase: string) => void }
  ): Promise<BonnieInstructionResult> {
    const response = await fetch('/api/bonnie/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        instruction,
        history,
        pathname: options.pathname,
        moduleContext: options.moduleContext,
      }),
    });

    if (!response.ok || !response.body) {
      const raw = await response.text().catch(() => '');
      let message = `Bonnie stream failed (${response.status}).`;
      try {
        const parsed = JSON.parse(raw);
        if (parsed.error) message = String(parsed.error);
      } catch {
        // ignore
      }
      return { response: message, success: false };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let streamedText = '';
    let finalResponse = '';
    let success = false;
    let toolsExecuted: BonnieToolExecuted[] | undefined;
    let pendingApproval: BonniePendingApprovalResponse | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() || '';

      for (const chunk of chunks) {
        const lines = chunk.split('\n');
        const eventLine = lines.find((line) => line.startsWith('event:'));
        const dataLine = lines.find((line) => line.startsWith('data:'));
        if (!eventLine || !dataLine) continue;

        const event = eventLine.replace('event:', '').trim();
        let data: any = {};
        try {
          data = JSON.parse(dataLine.replace('data:', '').trim());
        } catch {
          continue;
        }

        if (event === 'phase' && data.phase) {
          options.onPhase?.(String(data.phase));
        }
        if (event === 'token' && data.text) {
          streamedText += String(data.text);
          options.onToken?.(String(data.text));
        }
        if (event === 'done') {
          finalResponse = String(data.response || streamedText || '');
          success = Boolean(data.success);
          toolsExecuted = data.toolsExecuted as BonnieToolExecuted[] | undefined;
          pendingApproval = (data.pendingApproval as BonniePendingApprovalResponse | null) || null;
        }
        if (event === 'error') {
          return { response: String(data.message || 'Bonnie stream failed.'), success: false };
        }
      }
    }

    return {
      response: finalResponse || streamedText || 'Bonnie finished without a response.',
      success,
      toolsExecuted,
      pendingApproval,
    };
  },

  async sendVoiceCommand(
    tenantId: string,
    transcript: string,
    options?: { pathname?: string }
  ): Promise<BonnieInstructionResult & { intent?: string }> {
    try {
      const response = await fetch('/api/bonnie/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, transcript, pathname: options?.pathname }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        return { response: data.error || 'Voice command failed.', success: false };
      }
      return {
        response: data.response,
        success: true,
        toolsExecuted: (data.toolResults || []).map((r: { tool: string; success: boolean; summary: string }) => ({
          tool: r.tool,
          success: r.success,
          summary: r.summary,
        })),
        intent: data.intent,
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Voice request failed';
      return { response: message, success: false };
    }
  },
};
