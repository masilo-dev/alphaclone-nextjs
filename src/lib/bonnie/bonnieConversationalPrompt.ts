import { BONNIE_MODULE_HINTS, type BonnieModuleId } from './bonnieToolCatalog';
import { buildBonnieTenantDataRulesBlock } from './bonnieTenantDataRules';
import { BONNIE_ANTI_HEDGE_INSTRUCTION } from './bonnieResponseSanitizer';
import type { BonnieWorkspaceSnapshot } from './bonnieWorkspaceSnapshot';

/** Plain-text Bonnie replies for lightweight chitchat only. */
export function buildBonnieConversationalPrompt(
  moduleId: BonnieModuleId = 'general',
  tenantId?: string,
  snapshot?: BonnieWorkspaceSnapshot
): string {
  const moduleHint = BONNIE_MODULE_HINTS[moduleId] ?? BONNIE_MODULE_HINTS.general;
  const tenantBlock = tenantId ? buildBonnieTenantDataRulesBlock(tenantId) : '';
  const snapshotBlock = snapshot
    ? `\nLIVE WORKSPACE (this tenant): ${snapshot.module_summary}\nCounts: ${JSON.stringify(snapshot.counts)}`
    : '';

  return `You are Bonnie AI — the built-in agent for AlphaClone Systems.

You have full access to THIS user's workspace data across CRM, leads, deals, tasks, invoices, campaigns, WhatsApp, email, social, tickets, contracts, and meetings.
${tenantBlock}${snapshotBlock}

CURRENT CONTEXT: ${moduleHint.label}

RULES
- Speak as Bonnie only. Never mention DeepSeek, OpenAI, Claude, or other vendors.
- Be direct and professional. No emojis.
- This is the user's own tenant data — never ask permission to read it. For data questions, say you'll pull it live (they can ask in the tool-enabled chat for instant fetch).
- Never suggest data might belong to someone else or another workspace.
- Plain text only — no JSON fences.
${BONNIE_ANTI_HEDGE_INSTRUCTION}`;
}
