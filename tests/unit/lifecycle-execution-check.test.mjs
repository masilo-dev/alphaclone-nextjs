/**
 * Lifecycle Execution Reality Check
 * Tests whether each stage of the full business lifecycle has a REAL handler
 * (not just a schema/manifest entry) and whether bridge tools will execute or stub.
 */
import { getUnifiedMcpTools } from '../../src/lib/mcp/listAllTools.ts';
import { hasTool, initializeRegistry } from '../../src/lib/mcp/tool-registry.ts';

// Ensure all tool modules are loaded before we check hasTool
initializeRegistry();


// Core lifecycle tool names grouped by stage
const LIFECYCLE_TOOLS = {
  'CRM': ['create_lead', 'create_contact', 'get_contacts', 'create_client', 'log_contact_activity'],
  'Deals': ['create_deal', 'get_deals', 'move_deal_stage'],
  'Contracts': ['create_contract', 'get_contracts', 'create_contract_template'],
  'Invoicing': ['create_invoice', 'get_invoices', 'mark_invoice_paid', 'send_invoice', 'send_receipt', 'reconcile_payment'],
  'Finance': ['create_quote', 'create_expense', 'get_pnl_statement', 'get_balance_sheet', 'create_journal_entry'],
  'Projects': ['create_project', 'create_task', 'get_projects'],
  'Email': ['send_email', 'create_email_draft', 'create_bulk_email_campaign'],
  'Social': ['upload_media', 'get_social_identities', 'create_social_post_with_media', 'publish_social_post'],
  'Analytics': ['revenue_dashboard', 'accounting_snapshot', 'get_cash_flow_statement'],
};

async function run() {
  const tools = await getUnifiedMcpTools({ catalogMode: 'full' });
  const toolMap = new Map(tools.map(t => [t.name, t]));

  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║       FULL LIFECYCLE EXECUTION REALITY CHECK                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  let totalTools = 0, withRealHandler = 0, bridgeOnly = 0, notInCatalog = 0;

  const bridgeStubs = [];
  const missingTools = [];

  for (const [stage, toolNames] of Object.entries(LIFECYCLE_TOOLS)) {
    console.log(`\n── ${stage} ──`);
    for (const name of toolNames) {
      totalTools++;
      const inCatalog = toolMap.has(name);
      const hasHandler = hasTool(name);
      const tool = toolMap.get(name);
      const mod = tool?._module ?? tool?.module ?? '?';

      if (inCatalog && hasHandler) {
        // Check if it's a bridge-registered tool vs domain module
        const isBridge = mod === 'manifest-bridge' || mod === '?';
        if (isBridge) {
          console.log(`  ⚠️  ${name}  [manifest-bridge → will try MCPServer then stub if missing]`);
          bridgeStubs.push(name);
          bridgeOnly++;
        } else {
          console.log(`  ✅ ${name}  [real handler in: ${mod}]`);
          withRealHandler++;
        }
      } else if (inCatalog && !hasHandler) {
        console.log(`  ⚠️  ${name}  [discoverable, no registered handler]`);
        bridgeStubs.push(name);
        bridgeOnly++;
      } else {
        console.log(`  ❌ ${name}  [NOT IN CATALOG AT ALL]`);
        missingTools.push(name);
        notInCatalog++;
      }
    }
  }

  console.log(`\n╔═══════════════════════════════════════════════════════════════╗`);
  console.log(`║  ✅ ${withRealHandler} tools: REAL dedicated handlers                       ║`);
  console.log(`║  ⚠️  ${bridgeOnly} tools: bridge/MCPServer path (may stub)              ║`);
  console.log(`║  ❌ ${notInCatalog} tools: MISSING entirely                              ║`);
  console.log(`╚═══════════════════════════════════════════════════════════════╝`);

  if (bridgeStubs.length > 0) {
    console.log(`\n⚠️  Bridge/stub tools (need MCPServer legacy handlers or real impl):`);
    bridgeStubs.forEach(n => console.log(`   - ${n}`));
  }
  if (missingTools.length > 0) {
    console.log(`\n❌ Tools completely missing from catalog:`);
    missingTools.forEach(n => console.log(`   - ${n}`));
  }

  if (notInCatalog > 0) process.exit(1);
}

run().catch(err => { console.error('FATAL:', err); process.exit(1); });
