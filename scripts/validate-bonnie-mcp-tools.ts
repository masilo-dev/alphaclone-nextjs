/**
 * Validates Bonnie MCP tools in a single session (registry + MCPServer).
 * Usage: npm run validate:mcp
 * Optional: npm run validate:mcp -- --http  (hits production /api/mcp; needs MCP_TOKEN in env)
 */
import { createRequire } from 'node:module';
import * as dotenv from 'dotenv';
import * as path from 'path';

// CLI/tsx loads tool modules outside Next — stub before any server-only imports.
createRequire(import.meta.url)('./stub-server-only.cjs');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/** AlphaClone production tenant — no env vars required. */
const DEFAULT_TENANT_ID = '51772ee6-dee8-4c42-81f7-0fee297e5b27';
const DEFAULT_USER_ID = 'df841125-59ce-4e09-aa2d-5b746ec03d9b';

type ToolResult = {
  tool: string;
  ok: boolean;
  skipped?: boolean;
  error?: string;
  preview?: string;
};

function previewText(result: { content?: Array<{ text?: string }>; isError?: boolean }): string {
  const text = result.content?.[0]?.text || '';
  return text.length > 280 ? `${text.slice(0, 280)}...` : text;
}

function resolveContext(): { tenantId: string; userId: string } {
  return { tenantId: DEFAULT_TENANT_ID, userId: DEFAULT_USER_ID };
}

/** Provider/env gaps that are not product regressions in local validation. */
function isExpectedEnvironmentGap(tool: string, text: string): string | null {
  if (tool === 'create_linkedin_post' && /LINKEDIN_NOT_CONNECTED/i.test(text)) {
    return 'Skipped — LinkedIn not connected for validation tenant';
  }
  if (
    (tool === 'get_zoho_mail_messages' || tool === 'reply_to_zoho_mail') &&
    /ZOHO_ENCRYPTION_SECRET|not connected|ZOHO_/i.test(text)
  ) {
    return 'Skipped — Zoho mail env/connection not configured locally';
  }
  return null;
}

async function runToolLocal(
  tool: string,
  args: Record<string, unknown>,
  tenantId: string,
  userId: string
): Promise<ToolResult> {
  try {
    const { executeBonnieMcpTool } = await import('../src/lib/bonnie/bonnieMcpBridge');
    const result = await executeBonnieMcpTool(tool, args, tenantId, userId);
    const text = previewText(result);
    if (result.isError || text.includes('"error":true')) {
      const skip = isExpectedEnvironmentGap(tool, text);
      if (skip) return { tool, ok: false, skipped: true, error: skip };
      return { tool, ok: false, error: text };
    }
    return { tool, ok: true, preview: text };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const skip = isExpectedEnvironmentGap(tool, message);
    if (skip) return { tool, ok: false, skipped: true, error: skip };
    return { tool, ok: false, error: message };
  }
}

async function runToolHttp(
  tool: string,
  args: Record<string, unknown>,
  tenantId: string,
  userId: string,
  baseUrl: string,
  token: string
): Promise<ToolResult> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: tool,
          arguments: { ...args, tenant_id: tenantId, user_id: userId },
        },
      }),
    });
    const payload = await res.json();
    const text = JSON.stringify(payload?.result || payload?.error || payload);
    if (!res.ok || payload?.error) {
      return { tool, ok: false, error: text };
    }
    return { tool, ok: true, preview: text.slice(0, 280) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { tool, ok: false, error: message };
  }
}

async function main() {
  const useHttp = process.argv.includes('--http');
  const { tenantId, userId } = resolveContext();
  const run = useHttp
    ? (tool: string, args: Record<string, unknown>) => {
        const baseUrl = process.env.MCP_BASE_URL || 'https://alphaclonesystems.com';
        const token = process.env.MCP_TOKEN || process.env.MCP_API_KEY || '';
        if (!token) throw new Error('MCP_TOKEN or MCP_API_KEY required for --http mode');
        return runToolHttp(tool, args, tenantId, userId, baseUrl, token);
      }
    : (tool: string, args: Record<string, unknown>) =>
        runToolLocal(tool, args, tenantId, userId);

  console.log(`\nBonnie MCP tool validation`);
  console.log(`Mode: ${useHttp ? 'HTTP' : 'local'}`);
  console.log(`Tenant: ${tenantId}`);
  console.log(`User:   ${userId}\n`);

  const results: ToolResult[] = [];
  const base = { tenant_id: tenantId, user_id: userId };

  // 1. CRM read
  results.push(await run('get_clients', { ...base, limit: 3 }));

  const clientsPreview = results[0].preview || '';
  let clientId: string | null = null;
  try {
    const parsed = JSON.parse(clientsPreview);
    clientId = parsed?.[0]?.id || parsed?.items?.[0]?.id || null;
  } catch {
    clientId = null;
  }

  // 2. Leads
  const leadName = `MCP Validation ${Date.now()}`;
  const leadRes = await run('create_lead', {
    ...base,
    business_name: leadName,
    email: `mcp.validate+${Date.now()}@example.com`,
    source: 'mcp_validation',
  });
  results.push(leadRes);

  let leadId: string | null = null;
  if (leadRes.preview) {
    const idMatch = leadRes.preview.match(/ID:\s*([0-9a-f-]{36})/i);
    leadId = idMatch?.[1] || null;
  }

  if (leadId) {
    results.push(
      await run('update_lead', {
        ...base,
        lead_id: leadId,
        notes: 'Updated by validate-bonnie-mcp-tools',
      })
    );
  } else {
    results.push({ tool: 'update_lead', ok: false, skipped: true, error: 'No lead_id from create_lead' });
  }

  // 3. Invoicing
  if (clientId) {
    const invRes = await run('create_invoice', {
      ...base,
      client_id: clientId,
      amount: 1,
      due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    });
    results.push(invRes);

    let invoiceId: string | null = null;
    if (invRes.preview) {
      try {
        const parsed = JSON.parse(invRes.preview);
        invoiceId = parsed?.id || null;
      } catch {
        const m = invRes.preview.match(/"id"\s*:\s*"([0-9a-f-]{36})"/);
        invoiceId = m?.[1] || null;
      }
    }

    if (invoiceId) {
      results.push(
        await run('update_invoice_status', {
          ...base,
          invoice_id: invoiceId,
          status: 'draft',
        })
      );
      results.push(
        await run('send_invoice', {
          ...base,
          invoice_id: invoiceId,
        })
      );
    } else {
      results.push({
        tool: 'send_invoice',
        ok: false,
        skipped: true,
        error: 'No invoice_id from create_invoice',
      });
    }
  } else {
    results.push({
      tool: 'create_invoice',
      ok: false,
      skipped: true,
      error: 'No client_id from get_clients',
    });
  }

  // 4. Contracts
  const contractRes = await run('create_contract', {
    ...base,
    title: `MCP Validation Contract ${Date.now()}`,
    content: 'Validation draft contract body.',
    status: 'draft',
  });
  results.push(contractRes);

  let contractId: string | null = null;
  if (contractRes.preview) {
    try {
      const parsed = JSON.parse(contractRes.preview);
      contractId = parsed?.id || null;
    } catch {
      const m = contractRes.preview.match(/"id"\s*:\s*"([0-9a-f-]{36})"/);
      contractId = m?.[1] || null;
    }
  }

  if (contractId) {
    results.push(
      await run('generate_contract_signing_token', {
        ...base,
        contract_id: contractId,
      })
    );
    results.push({
      tool: 'send_contract',
      ok: false,
      skipped: true,
      error: 'Skipped — requires real recipient_email to avoid spam',
    });
  }

  // 5. Social (scheduled only — no publish)
  const scheduledAt = new Date(Date.now() + 7 * 86400000).toISOString();
  results.push(
    await run('create_social_post', {
      ...base,
      caption: 'MCP validation post. No emoji. Outcome-first test line.',
      link_url: 'https://alphaclonesystems.com',
      platforms: ['facebook'],
      publish_now: false,
      scheduled_at: scheduledAt,
      auto_refine_with_context: false,
    })
  );
  results.push(
    await run('create_linkedin_post', {
      ...base,
      text: 'MCP validation LinkedIn draft. Plain text only.',
      link_url: 'https://alphaclonesystems.com',
      publish_now: false,
      scheduled_at: scheduledAt,
    })
  );

  // 6. Mail (read-only / expected auth failures logged)
  results.push(await run('get_zoho_mail_messages', { ...base, limit: 3 }));
  results.push({
    tool: 'reply_to_zoho_mail',
    ok: false,
    skipped: true,
    error: 'Skipped — requires live message_id',
  });
  results.push({
    tool: 'gmail_send_email',
    ok: false,
    skipped: true,
    error: 'Skipped — requires live Gmail thread and would send email',
  });

  // 7. Tasks
  const taskRes = await run('create_task', {
    ...base,
    title: `MCP validation task ${Date.now()}`,
    due_date: new Date(Date.now() + 3 * 86400000).toISOString(),
    priority: 'medium',
  });
  results.push(taskRes);
  results.push(await run('get_tasks', { ...base, limit: 5 }));

  let taskId: string | null = null;
  if (taskRes.preview) {
    const m = taskRes.preview.match(/"id"\s*:\s*"([0-9a-f-]{36})"/);
    taskId = m?.[1] || null;
  }
  if (taskId) {
    results.push(
      await run('update_task', {
        ...base,
        task_id: taskId,
        status: 'in_progress',
      })
    );
  }

  // 8. Accounting
  results.push(await run('get_pnl_statement', { ...base, period: 'monthly' }));
  results.push(await run('get_balance_sheet', { ...base }));
  results.push(await run('get_revenue_summary', { ...base }));

  // 9. Known bug-fix regression tools (non-destructive / dry-run where possible)
  results.push(
    await run('create_deal', {
      ...base,
      name: `MCP Bugfix Deal ${Date.now()}`,
      value: 100,
      stage: 'qualified',
    })
  );
  // Prefer facebook — create_social_post already validated against it; resolve identity when multi-account.
  let scheduleIdentityId: string | undefined;
  try {
    const idRes = await run('get_social_identities', { ...base, provider: 'facebook' });
    if (idRes.ok && idRes.preview) {
      const parsed = JSON.parse(idRes.preview);
      const list = parsed?.identities || parsed?.data?.identities || [];
      const pick =
        list.find((i: { can_publish?: boolean; is_default?: boolean }) => i.can_publish && i.is_default) ||
        list.find((i: { can_publish?: boolean }) => i.can_publish) ||
        list[0];
      scheduleIdentityId = pick?.identity_id;
    }
  } catch {
    /* optional probe */
  }
  results.push(
    await run('schedule_social_post', {
      ...base,
      platform: 'facebook',
      content: 'MCP validation scheduled post — no publish.',
      scheduled_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      ...(scheduleIdentityId ? { identity_id: scheduleIdentityId } : {}),
    })
  );
  results.push(
    await run('generate_contract_draft', {
      ...base,
      contract_type: 'Service Agreement',
      client_name: 'MCP Validation Client',
      key_terms: 'Standard SaaS terms, 12-month term.',
    })
  );
  if (clientId) {
    results.push({
      tool: 'send_transactional_email',
      ok: false,
      skipped: true,
      error: 'Skipped — would send live email; client_id recipient resolution covered by resolveMcpEmailRecipient unit path',
    });
  }
  results.push({
    tool: 'send_batch_outreach',
    ok: false,
    skipped: true,
    error: 'Skipped — would send live outreach emails',
  });
  results.push({
    tool: 'create_post_with_ai_image',
    ok: false,
    skipped: true,
    error: 'Skipped — requires OpenAI/xAI billing; billing guard tested at handler level',
  });

  // Report
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;

  console.log('--- Results ---');
  for (const r of results) {
    const status = r.ok ? 'PASS' : r.skipped ? 'SKIP' : 'FAIL';
    console.log(`[${status}] ${r.tool}`);
    if (r.error) console.log(`       ${r.error.slice(0, 200)}`);
  }

  console.log(`\nSummary: ${passed} passed, ${failed} failed, ${skipped} skipped (${results.length} total)\n`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
