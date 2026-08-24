import { initializeRegistry, listTools } from './src/lib/mcp/tool-registry';
import { MCP_TOOLS } from './src/services/mcp/toolManifest';
import { SUPPLEMENTAL_MCP_TOOLS } from './src/lib/mcp/supplementalToolDefinitions';
import * as fs from 'fs';

async function groupMissing() {
  initializeRegistry();
  const registeredNames = new Set(listTools(false).map(t => t.name));

  const allManifestAndSupp = [...MCP_TOOLS, ...SUPPLEMENTAL_MCP_TOOLS];
  const missing = allManifestAndSupp.filter(t => !registeredNames.has(t.name));

  console.log(`Total missing tools: ${missing.length}`);

  // Deduplicate missing by name
  const missingMap = new Map();
  for (const t of missing) {
    if (!missingMap.has(t.name)) {
      missingMap.set(t.name, t);
    }
  }

  const uniqueMissing = Array.from(missingMap.values());
  console.log(`Unique missing tools: ${uniqueMissing.length}`);

  // Group by probable domain/category or prefix
  const groups: Record<string, string[]> = {};

  for (const t of uniqueMissing) {
    let domain = 'other';
    const name = t.name;
    if (name.startsWith('gmail_') || name.includes('email') || name.includes('outreach') || name.includes('zoho_mail') || name.includes('draft')) {
      domain = 'email_outreach';
    } else if (name.includes('client') || name.includes('lead') || name.includes('contact') || name.includes('deal') || name.includes('crm')) {
      domain = 'crm_leads';
    } else if (name.includes('linkedin') || name.includes('facebook') || name.includes('social') || name.includes('post')) {
      domain = 'social_marketing';
    } else if (name.includes('bank') || name.includes('reconciliation') || name.includes('bill') || name.includes('expense') || name.includes('pnl') || name.includes('receipt') || name.includes('quote') || name.includes('invoice') || name.includes('payment')) {
      domain = 'finance_accounting';
    } else if (name.includes('contract')) {
      domain = 'contracts_legal';
    } else if (name.includes('task') || name.includes('project') || name.includes('milestone')) {
      domain = 'projects_tasks';
    } else if (name.includes('playbook') || name.includes('run_') || name.includes('automation') || name.includes('audit') || name.includes('report') || name.includes('throughput') || name.includes('scan') || name.includes('autonomous')) {
      domain = 'automation_ops';
    } else if (name.includes('ticket')) {
      domain = 'tickets_support';
    } else if (name.includes('event') || name.includes('calendly') || name.includes('calendar') || name.includes('meeting')) {
      domain = 'calendar_events';
    } else if (name.includes('image') || name.includes('document') || name.includes('media') || name.includes('url')) {
      domain = 'content_media';
    } else if (name.includes('search') || name.includes('tools') || name.includes('summary') || name.includes('workspace')) {
      domain = 'discovery_system';
    }

    if (!groups[domain]) groups[domain] = [];
    groups[domain].push(name);
  }

  for (const [domain, list] of Object.entries(groups)) {
    console.log(`\n--- ${domain.toUpperCase()} (${list.length}) ---`);
    console.log(list);
  }
}

groupMissing().catch(console.error);
