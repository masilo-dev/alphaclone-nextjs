/**
 * Model-agnostic intent adapter — maps free text or aliases to canonical outcome missions.
 */

import {
  getOutcomeMission,
  OUTCOME_MISSIONS,
  SUPPORTED_OUTCOME_KEYS,
  type OutcomeMissionDefinition,
} from '@/lib/mcp/outcomeDefinitions';

export type ParsedOutcomeIntent = {
  outcome_key: string;
  mission: OutcomeMissionDefinition;
  confidence: 'explicit' | 'keyword' | 'fallback';
  matched_phrase?: string;
};

const ALIAS_MAP: Record<string, string> = {
  content_to_publish: 'content_to_publish',
  'content-to-publish': 'content_to_publish',
  publish_content: 'content_to_publish',
  publish_social: 'content_to_publish',
  post_to_social: 'content_to_publish',
  post_to_linkedin: 'content_to_publish',
  post_to_facebook: 'content_to_publish',
  lead_to_meeting: 'lead_to_meeting',
  'lead-to-meeting': 'lead_to_meeting',
  book_meeting: 'lead_to_meeting',
  schedule_meeting_with_lead: 'lead_to_meeting',
  send_outreach_email: 'send_outreach_email',
  send_email_outreach: 'send_outreach_email',
  email_outreach: 'send_outreach_email',
  meeting_to_deal: 'meeting_to_deal',
  'meeting-to-deal': 'meeting_to_deal',
  advance_deal: 'meeting_to_deal',
  quote_to_cash: 'quote_to_cash',
  'quote-to-cash': 'quote_to_cash',
  send_invoice_outcome: 'quote_to_cash',
  collect_payment: 'quote_to_cash',
  contract_to_project: 'contract_to_project',
  'contract-to-project': 'contract_to_project',
  signed_contract_to_project: 'contract_to_project',
  project_to_delivery: 'project_to_delivery',
  'project-to-delivery': 'project_to_delivery',
  deliver_project: 'project_to_delivery',
};

const KEYWORD_RULES: Array<{ pattern: RegExp; outcome: string; phrase: string }> = [
  {
    pattern: /\b(publish|post).*(linkedin|facebook|social|content|article|post)\b/i,
    outcome: 'content_to_publish',
    phrase: 'publish social content',
  },
  {
    pattern: /\b(linkedin|facebook).*(publish|post)\b/i,
    outcome: 'content_to_publish',
    phrase: 'publish social content',
  },
  {
    pattern: /\b(lead|prospect).*(meeting|call|demo|book)\b/i,
    outcome: 'lead_to_meeting',
    phrase: 'lead to meeting',
  },
  {
    pattern: /\b(send|email|outreach).*(email|message)\b/i,
    outcome: 'send_outreach_email',
    phrase: 'send outreach email',
  },
  {
    pattern: /\b(meeting|call).*(deal|proposal|pipeline)\b/i,
    outcome: 'meeting_to_deal',
    phrase: 'meeting to deal',
  },
  {
    pattern: /\b(deal|proposal).*(advance|stage|pipeline)\b/i,
    outcome: 'meeting_to_deal',
    phrase: 'advance deal',
  },
  {
    pattern: /\b(invoice|quote|bill).*(send|cash|collect|payment)\b/i,
    outcome: 'quote_to_cash',
    phrase: 'quote to cash',
  },
  {
    pattern: /\b(send|email).*(invoice|bill)\b/i,
    outcome: 'quote_to_cash',
    phrase: 'send invoice',
  },
  {
    pattern: /\b(project|kickoff).*(contract|signed)\b/i,
    outcome: 'contract_to_project',
    phrase: 'project from contract',
  },
  {
    pattern: /\b(signed|executed).*(contract).*(project|kickoff|delivery)\b/i,
    outcome: 'contract_to_project',
    phrase: 'contract to project',
  },
  {
    pattern: /\b(contract).*(project|kickoff)\b/i,
    outcome: 'contract_to_project',
    phrase: 'contract to project',
  },
  {
    pattern: /\b(project).*(deliver|delivery|handoff|complete)\b/i,
    outcome: 'project_to_delivery',
    phrase: 'project to delivery',
  },
];

export function resolveOutcomeKey(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (ALIAS_MAP[key]) return ALIAS_MAP[key];
  if (OUTCOME_MISSIONS[key]) return key;
  return null;
}

export function adaptIntent(input: {
  outcome_key?: string | null;
  intent?: string | null;
  objective?: string | null;
}): ParsedOutcomeIntent | null {
  const explicit = resolveOutcomeKey(input.outcome_key || '');
  if (explicit) {
    const mission = getOutcomeMission(explicit);
    if (mission) {
      return { outcome_key: explicit, mission, confidence: 'explicit' };
    }
  }

  const text = [input.intent, input.objective].filter(Boolean).join(' ').trim();
  if (!text) return null;

  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(text)) {
      const mission = getOutcomeMission(rule.outcome);
      if (mission) {
        return {
          outcome_key: rule.outcome,
          mission,
          confidence: 'keyword',
          matched_phrase: rule.phrase,
        };
      }
    }
  }

  return null;
}

export function normalizeOutcomeParams(
  mission: OutcomeMissionDefinition,
  raw: Record<string, unknown>
): { params: Record<string, unknown>; missing: string[] } {
  const params: Record<string, unknown> = { ...raw };
  if (params.content && !params.caption) params.caption = params.content;
  if (params.message && !params.text) params.text = params.message;
  if (params.body && !params.text) params.text = params.body;
  if (params.execute_actions === true) params.execute = true;
  if (params.execute_actions === false) params.execute = false;
  if (params.publish_now === true) params.execute = true;
  if (params.lead_id && !params.query) params.query = String(params.lead_id);
  if (params.lead_id && !params.lead_ids) params.lead_ids = [String(params.lead_id)];
  if (params.meeting_title && !params.title) params.title = params.meeting_title;
  if (!params.meeting_title && params.lead_id && !params.title) {
    params.title = `Meeting with lead ${params.lead_id}`;
    params.meeting_title = params.title;
  }
  if (params.deal_id && !params.stage) params.stage = 'proposal';
  if (params.project_name && !params.name) params.name = params.project_name;
  if (params.delivery_task_title && !params.title) params.title = params.delivery_task_title;
  if (mission.key === 'project_to_delivery' && !params.title) {
    params.title = 'Complete delivery checklist';
  }
  if (mission.key === 'project_to_delivery') {
    params.fields = {
      status: typeof params.target_status === 'string' ? params.target_status : 'active',
    };
  }

  const execute =
    params.execute === true ||
    params.execute === 'true' ||
    params.mode === 'execute_now' ||
    params.status === 'execute_now';
  params.execute = execute;

  const missing = mission.requiredParams.filter((key) => {
    const val = params[key];
    if (val === undefined || val === null) return true;
    if (typeof val === 'string' && !val.trim()) return true;
    return false;
  });

  if (mission.key === 'quote_to_cash') {
    const hasInvoice = Boolean(params.invoice_id);
    const hasCreate = Boolean(params.client_id && params.amount);
    if (!hasInvoice && !hasCreate) {
      return {
        params,
        missing: ['invoice_id or (client_id and amount)'],
      };
    }
    return { params, missing: [] };
  }

  return { params, missing };
}

export function listSupportedOutcomesForDiscovery() {
  return SUPPORTED_OUTCOME_KEYS.map((key) => {
    const mission = OUTCOME_MISSIONS[key];
    return {
      outcome_key: key,
      title: mission.title,
      description: mission.description,
      required_params: mission.requiredParams,
      optional_params: mission.optionalParams,
      step_count: mission.steps.length,
    };
  });
}
