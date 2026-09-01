/**
 * Canonical governed outcome missions — decomposed into MCP tool steps.
 * @see docs/MCP_OPERATING_ROADMAP_2026-08-20.md
 */

export type OutcomeStepMode = 'read' | 'dry_run' | 'draft' | 'execute_now';

export type OutcomeStepDefinition = {
  id: string;
  title: string;
  tool: string;
  mode: OutcomeStepMode;
  /** Static args merged before param binding */
  staticArgs?: Record<string, unknown>;
  /** Param keys from request_outcome input bound into tool args */
  bindParams?: string[];
  /** Output keys from prior steps injected into args (e.g. social_post_id) */
  bindFromPrior?: Record<string, string>;
  skipWhen?: 'execute_false' | 'has_invoice_id' | 'missing_invoice_id' | 'has_project_id' | 'missing_project_id';
};

export type OutcomeMissionDefinition = {
  key: string;
  title: string;
  description: string;
  requiredParams: string[];
  optionalParams: string[];
  steps: OutcomeStepDefinition[];
};

export const OUTCOME_MISSIONS: Record<string, OutcomeMissionDefinition> = {
  content_to_publish: {
    key: 'content_to_publish',
    title: 'Content-to-Publish',
    description:
      'Validate social readiness, resolve identity, preflight, publish with receipt, and verify provider post.',
    requiredParams: ['caption'],
    optionalParams: ['identity_id', 'platform', 'identity_type', 'target', 'media_asset_ids', 'execute'],
    steps: [
      {
        id: 'readiness',
        title: 'Check social publish readiness',
        tool: 'check_mcp_execution_readiness',
        mode: 'read',
        staticArgs: { action: 'social_post' },
      },
      {
        id: 'identities',
        title: 'List publishable social identities',
        tool: 'get_social_identities',
        mode: 'read',
      },
      {
        id: 'preflight',
        title: 'Preflight publish (no provider write)',
        tool: 'preflight_social_publish',
        mode: 'dry_run',
        bindParams: ['caption', 'content', 'identity_id', 'platform', 'identity_type', 'target', 'media_asset_ids'],
        staticArgs: { dry_run: true },
      },
      {
        id: 'publish',
        title: 'Publish to provider',
        tool: 'publish_social_post',
        mode: 'execute_now',
        bindParams: ['caption', 'content', 'identity_id', 'platform', 'identity_type', 'target', 'media_asset_ids'],
        staticArgs: { publish_now: true, status: 'execute_now' },
        skipWhen: 'execute_false',
      },
      {
        id: 'verify',
        title: 'Verify published post',
        tool: 'verify_social_post_published',
        mode: 'read',
        bindFromPrior: { social_post_id: 'publish.social_post_id' },
        skipWhen: 'execute_false',
      },
    ],
  },
  lead_to_meeting: {
    key: 'lead_to_meeting',
    title: 'Lead-to-Meeting',
    description: 'Find the lead in CRM, qualify fit, and schedule a video meeting when execution is enabled.',
    requiredParams: ['lead_id'],
    optionalParams: ['meeting_title', 'host_id', 'execute'],
    steps: [
      {
        id: 'lead',
        title: 'Search CRM for lead',
        tool: 'search_leads',
        mode: 'read',
        bindParams: ['query'],
      },
      {
        id: 'qualify',
        title: 'Qualify lead in CRM',
        tool: 'qualify_crm_leads',
        mode: 'read',
        bindParams: ['lead_ids'],
      },
      {
        id: 'schedule',
        title: 'Create video meeting room',
        tool: 'create_meeting',
        mode: 'execute_now',
        bindParams: ['host_id', 'meeting_title', 'title'],
        skipWhen: 'execute_false',
      },
    ],
  },
  send_outreach_email: {
    key: 'send_outreach_email',
    title: 'Send Outreach Email',
    description: 'Verify email readiness, resolve recipient, send with idempotency, return provider receipt.',
    requiredParams: ['to', 'subject', 'text'],
    optionalParams: ['recipient_name', 'contact_id', 'execute'],
    steps: [
      {
        id: 'readiness',
        title: 'Check email send readiness',
        tool: 'check_mcp_execution_readiness',
        mode: 'read',
        staticArgs: { action: 'email_send' },
      },
      {
        id: 'send',
        title: 'Send email via connected provider',
        tool: 'send_email',
        mode: 'execute_now',
        bindParams: ['to', 'subject', 'text', 'recipient_name', 'contact_id'],
        skipWhen: 'execute_false',
      },
    ],
  },
  meeting_to_deal: {
    key: 'meeting_to_deal',
    title: 'Meeting-to-Deal',
    description: 'Load pipeline deals, advance stage after a meeting, and optionally send follow-up email.',
    requiredParams: ['deal_id'],
    optionalParams: ['stage', 'to', 'subject', 'text', 'execute'],
    steps: [
      {
        id: 'deals',
        title: 'List pipeline deals',
        tool: 'get_deals',
        mode: 'read',
        bindParams: ['stage'],
      },
      {
        id: 'advance',
        title: 'Advance deal stage',
        tool: 'update_deal',
        mode: 'execute_now',
        bindParams: ['deal_id', 'stage'],
      },
      {
        id: 'follow_up',
        title: 'Send deal follow-up email',
        tool: 'send_email',
        mode: 'execute_now',
        bindParams: ['to', 'subject', 'text'],
        skipWhen: 'execute_false',
      },
    ],
  },
  quote_to_cash: {
    key: 'quote_to_cash',
    title: 'Quote-to-Cash',
    description: 'Create an invoice when needed, then send it with PDF and payment link when execution is enabled.',
    requiredParams: [],
    optionalParams: [
      'invoice_id',
      'client_id',
      'amount',
      'recipient_email',
      'execute',
    ],
    steps: [
      {
        id: 'readiness',
        title: 'Check email send readiness',
        tool: 'check_mcp_execution_readiness',
        mode: 'read',
        staticArgs: { action: 'email_send' },
      },
      {
        id: 'create',
        title: 'Create draft invoice',
        tool: 'create_invoice',
        mode: 'draft',
        bindParams: ['client_id', 'amount'],
        skipWhen: 'has_invoice_id',
      },
      {
        id: 'send',
        title: 'Send invoice to client',
        tool: 'send_invoice',
        mode: 'execute_now',
        bindParams: ['invoice_id', 'recipient_email'],
        bindFromPrior: { invoice_id: 'create.id' },
        skipWhen: 'execute_false',
      },
    ],
  },
  contract_to_project: {
    key: 'contract_to_project',
    title: 'Contract-to-Project',
    description:
      'Load a signed contract, create a linked project when needed, and kick off default delivery tasks when execution is enabled.',
    requiredParams: ['contract_id'],
    optionalParams: ['project_id', 'project_name', 'client_id', 'kickoff_tasks', 'execute'],
    steps: [
      {
        id: 'contract',
        title: 'Load contract record',
        tool: 'get_contracts',
        mode: 'read',
        bindParams: ['contract_id'],
      },
      {
        id: 'create',
        title: 'Create project from contract',
        tool: 'create_project',
        mode: 'execute_now',
        bindParams: ['project_name', 'name', 'client_id'],
        bindFromPrior: {
          name: 'contract.title',
          client_id: 'contract.client_id',
        },
        skipWhen: 'has_project_id',
      },
      {
        id: 'kickoff',
        title: 'Kick off project automation',
        tool: 'kickoff_project_automation',
        mode: 'execute_now',
        bindParams: ['project_id', 'kickoff_tasks'],
        bindFromPrior: { project_id: 'create.id' },
        skipWhen: 'execute_false',
      },
    ],
  },
  project_to_delivery: {
    key: 'project_to_delivery',
    title: 'Project-to-Delivery',
    description:
      'Inspect project readiness, create a delivery task, and advance project status when execution is enabled.',
    requiredParams: ['project_id'],
    optionalParams: ['delivery_task_title', 'target_status', 'execute'],
    steps: [
      {
        id: 'details',
        title: 'Load project details',
        tool: 'get_project_details',
        mode: 'read',
        bindParams: ['project_id'],
      },
      {
        id: 'tasks',
        title: 'List existing project tasks',
        tool: 'get_project_tasks',
        mode: 'read',
        bindParams: ['project_id'],
      },
      {
        id: 'delivery',
        title: 'Create delivery task',
        tool: 'create_project_task',
        mode: 'execute_now',
        bindParams: ['project_id', 'title'],
        staticArgs: { priority: 'high' },
        skipWhen: 'execute_false',
      },
      {
        id: 'advance',
        title: 'Advance project toward delivery',
        tool: 'update_project',
        mode: 'execute_now',
        bindParams: ['project_id', 'fields'],
        skipWhen: 'execute_false',
      },
    ],
  },
};

export const SUPPORTED_OUTCOME_KEYS = Object.keys(OUTCOME_MISSIONS);

export function getOutcomeMission(key: string): OutcomeMissionDefinition | null {
  return OUTCOME_MISSIONS[key] || null;
}
