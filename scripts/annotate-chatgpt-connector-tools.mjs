/**
 * Merge ChatGPT Apps SDK annotations for Alphaclone MCP connector tools
 * into chatgpt-app-submission.json without wiping existing entries.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TARGET = path.join(ROOT, "chatgpt-app-submission.json");

const READ_ONLY = {
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
    destructiveHint: false,
  },
  justifications: {
    read_only_justification:
      "Only reads or computes data and does not modify workspace or external state.",
    open_world_justification:
      "Does not write to public internet state or third-party systems.",
    destructive_justification:
      "Does not delete, cancel, overwrite, or revoke anything.",
  },
};

const MUTATING = {
  annotations: {
    readOnlyHint: false,
    openWorldHint: false,
    destructiveHint: false,
  },
  justifications: {
    read_only_justification:
      "Mutates private workspace data, so it is not read-only.",
    open_world_justification:
      "Operates only on private workspace data and does not publish externally.",
    destructive_justification:
      "Does not delete, cancel, overwrite, or revoke anything irreversibly.",
  },
};

const DESTRUCTIVE = {
  annotations: {
    readOnlyHint: false,
    openWorldHint: false,
    destructiveHint: true,
  },
  justifications: {
    read_only_justification:
      "Mutates private workspace data, so it is not read-only.",
    open_world_justification:
      "Operates only on private workspace data and does not publish externally.",
    destructive_justification: "Can delete or archive records; use with care.",
  },
};

const OPEN_WORLD = {
  annotations: {
    readOnlyHint: false,
    openWorldHint: true,
    destructiveHint: false,
  },
  justifications: {
    read_only_justification:
      "Mutates private workspace data, so it is not read-only.",
    open_world_justification:
      "May publish content to connected social platforms.",
    destructive_justification:
      "Does not delete, cancel, overwrite, or revoke anything irreversibly.",
  },
};

const UNIVERSAL_ROUTER = {
  annotations: {
    readOnlyHint: false,
    openWorldHint: true,
    destructiveHint: true,
  },
  justifications: {
    read_only_justification:
      "Routes to both read and write tools, so it cannot be classified as read-only.",
    open_world_justification:
      "May route to tools that send email, publish content, or call connected providers.",
    destructive_justification:
      "May route to destructive tools, which remain subject to RBAC and approval policy.",
  },
};

const TOOLS = {
  list_tools: READ_ONLY,
  list_modules: READ_ONLY,
  list_capabilities: READ_ONLY,
  search_tools: READ_ONLY,
  load_module_tools: READ_ONLY,
  dispatch_tool: UNIVERSAL_ROUTER,
  execute_action: UNIVERSAL_ROUTER,
  get_platform_status: READ_ONLY,
  get_system_health: READ_ONLY,
  get_version: READ_ONLY,
  get_environment: READ_ONLY,
  get_feature_flags: READ_ONLY,
  get_recent_errors: READ_ONLY,
  get_audit_logs: READ_ONLY,
  restart_service: MUTATING,
  audit_platform: READ_ONLY,
  list_conversations: READ_ONLY,
  get_conversation: READ_ONLY,
  list_workflows: READ_ONLY,
  get_workflow: READ_ONLY,
  run_workflow: MUTATING,
  stop_workflow: MUTATING,
  inspect_agent_reasoning: READ_ONLY,
  inspect_memory: READ_ONLY,
  inspect_tools: READ_ONLY,
  inspect_prompts: READ_ONLY,
  inspect_vector_store: READ_ONLY,
  inspect_embeddings: READ_ONLY,
  inspect_rag: READ_ONLY,
  inspect_planner: READ_ONLY,
  inspect_executor: READ_ONLY,
  inspect_scheduler: READ_ONLY,
  inspect_task_queue: READ_ONLY,
  list_leads: READ_ONLY,
  search_leads: READ_ONLY,
  create_lead: MUTATING,
  update_lead: MUTATING,
  delete_lead: DESTRUCTIVE,
  list_contacts: READ_ONLY,
  list_companies: READ_ONLY,
  pipeline_status: READ_ONLY,
  opportunities: READ_ONLY,
  connected_accounts: READ_ONLY,
  scheduled_posts: READ_ONLY,
  drafts: READ_ONLY,
  analytics: READ_ONLY,
  publish_post: OPEN_WORLD,
  delete_post: DESTRUCTIVE,
  engagement_report: READ_ONLY,
  campaigns: READ_ONLY,
  campaign_metrics: READ_ONLY,
  email_campaigns: READ_ONLY,
  funnels: READ_ONLY,
  landing_pages: READ_ONLY,
  conversions: READ_ONLY,
  invoices: READ_ONLY,
  quotes: READ_ONLY,
  payments: READ_ONLY,
  subscriptions: READ_ONLY,
  revenue_dashboard: READ_ONLY,
  events: READ_ONLY,
  tasks: READ_ONLY,
  reminders: READ_ONLY,
  appointments: READ_ONLY,
  search_documents: READ_ONLY,
  upload_document: MUTATING,
  retrieve_document: READ_ONLY,
  document_versions: READ_ONLY,
  dashboard_metrics: READ_ONLY,
  revenue_report: READ_ONLY,
  growth_report: READ_ONLY,
  customer_report: READ_ONLY,
  AI_usage_report: READ_ONLY,
  github_health: READ_ONLY,
  gmail_health: READ_ONLY,
  google_calendar_health: READ_ONLY,
  zoho_health: READ_ONLY,
  stripe_health: READ_ONLY,
  calendly_health: READ_ONLY,
  railway_health: READ_ONLY,
  supabase_health: READ_ONLY,
  openai_health: READ_ONLY,
  deepseek_health: READ_ONLY,
  integrations_status: READ_ONLY,
};

const doc = JSON.parse(fs.readFileSync(TARGET, "utf8"));
doc.tools = doc.tools || {};
let added = 0;
let updated = 0;
for (const [name, meta] of Object.entries(TOOLS)) {
  if (doc.tools[name]) {
    doc.tools[name] = meta;
    updated += 1;
  } else {
    doc.tools[name] = meta;
    added += 1;
  }
}

fs.writeFileSync(TARGET, `${JSON.stringify(doc, null, 2)}\n`);
console.log(
  `chatgpt-app-submission.json updated: added=${added} updated=${updated} total_tools=${Object.keys(doc.tools).length}`,
);
