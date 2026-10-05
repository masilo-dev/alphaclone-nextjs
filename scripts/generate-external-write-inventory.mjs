/**
 * Generates docs/architecture/P0_EXTERNAL_WRITE_INVENTORY.md from MCP tool metadata.
 * Run: node scripts/generate-external-write-inventory.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(root, '..');

const capabilityFilterSrc = fs.readFileSync(
  path.join(repoRoot, 'src/lib/mcp/capabilityFilter.ts'),
  'utf8'
);
const discovery = fs.readFileSync(path.join(repoRoot, 'src/lib/mcp/progressiveDiscovery.ts'), 'utf8');
const supplemental = fs.readFileSync(
  path.join(repoRoot, 'src/lib/mcp/supplementalToolDefinitions.ts'),
  'utf8'
);
const toolNames = [
  ...discovery.matchAll(/'([a-z][a-z0-9_]*)'/g),
  ...supplemental.matchAll(/name:\s*'([a-z][a-z0-9_]*)'/g),
].map((m) => m[1]);
const unique = [...new Set(toolNames)].sort();

const externalPattern = /(send|publish|post_to|queue_email|invoice|payment|contract|social)/i;
const rows = unique
  .filter((t) => externalPattern.test(t))
  .map((capability) => {
    const ui =
      capability === 'send_email'
        ? '/api/email/send'
        : capability === 'send_invoice'
          ? '/api/invoices/send'
          : capability === 'send_quote'
            ? '/api/quotes/send'
            : '—';
    const domain =
      capability === 'send_email'
        ? 'executeSendEmailCommand → EmailExecutionService'
        : capability === 'send_invoice'
          ? 'executeInvoiceSendCommand → queueInvoiceSend'
          : capability === 'promote_lead_candidate'
            ? 'promoteToCanonicalLead'
            : capability.includes('social')
              ? 'socialPublishTool / social schedule (partial UI)'
              : 'MCPServer legacy / domain service (audit)';
    let classification = 'UNKNOWN';
    if (['send_email', 'send_invoice', 'promote_lead_candidate'].includes(capability)) {
      classification = 'CANONICAL';
    } else if (['send_quote', 'publish_social_post', 'reply_to_email'].includes(capability)) {
      classification = 'PARTIAL';
    } else if (/^(brevo|sendgrid|resend)/.test(capability)) {
      classification = 'BYPASS';
    }
    return `| ${capability} | UI: ${ui}; MCP: executeTool | ${domain} | evaluateToolPolicy | MCP+UI keys (critical) | executeDomainExternalWrite | gateway/verification | tenant events (where wired) | ${classification === 'CANONICAL' ? '—' : 'non-unified surfaces remain'} | ${classification} |`;
  });

const md = `# P0 External Write Inventory (generated)

Generated: ${new Date().toISOString()}

| Capability | Entry surfaces | Domain service | Policy | Idempotency | Receipt | Verification | Canonical event | Remaining bypass | Class |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

## Direct provider routes (deprecated)

| Route | Class | Notes |
| --- | --- | --- |
| /api/brevo/send | LEGACY/BYPASS | Deprecated — use /api/email/send |
| /api/sendgrid/send | LEGACY/BYPASS | Deprecated — use /api/email/send |
| /api/resend/send | LEGACY/BYPASS | Deprecated — use /api/email/send |
| /api/gmail/messages/send | PARTIAL | OAuth adapter — should route through send_email command |

`;

const out = path.join(repoRoot, 'docs/architecture/P0_EXTERNAL_WRITE_INVENTORY.md');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, md);
console.log('Wrote', out, 'rows:', rows.length);
