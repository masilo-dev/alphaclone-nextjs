import { getBonnieWorkspaceSnapshot } from '@/lib/bonnie/bonnieWorkspaceSnapshot';
import { callDeepSeek } from '@/lib/ai/deepseek';
import type { BonnieToolResult } from '@/lib/bonnie/bonnieToolExecutor';

export async function executeCustomTool(
  tool: string,
  tenantId: string,
  userId: string,
  args: Record<string, unknown> = {}
): Promise<BonnieToolResult> {
  if (tool === 'run_autonomous_scan') {
    const { autonomousRunnerService } = await import('@/services/autonomousRunnerService');
    const result = await autonomousRunnerService.runForTenant(tenantId);
    const actionCount = result.run?.actions?.length ?? 0;
    return {
      tool,
      success: result.success,
      summary: result.success
        ? `Autonomous scan finished (${actionCount} actions).`
        : `Autonomous scan failed: ${result.error || 'unknown error'}`,
      details: `${actionCount} actions executed.`,
    };
  }

  if (tool === 'summarize_workspace') {
    const snapshot = await getBonnieWorkspaceSnapshot(tenantId);
    const summary: string[] = [];
    if (snapshot.counts.leads) summary.push(`${snapshot.counts.leads} leads`);
    if (snapshot.counts.deals) summary.push(`${snapshot.counts.deals} deals`);
    if (snapshot.counts.open_tickets) summary.push(`${snapshot.counts.open_tickets} tickets`);
    if (snapshot.counts.unpaid_invoices) summary.push(`${snapshot.counts.unpaid_invoices} unpaid invoices`);
    if (snapshot.counts.open_tasks) summary.push(`${snapshot.counts.open_tasks} tasks`);
    if (snapshot.counts.contacts) summary.push(`${snapshot.counts.contacts} contacts`);
    if (snapshot.counts.clients) summary.push(`${snapshot.counts.clients} clients`);

    return {
      tool,
      success: true,
      summary: summary.length > 0 ? `Workspace: ${summary.join(', ')}` : 'Workspace snapshot loaded.',
      details: summary.join(', ') || 'Workspace data retrieved successfully.',
    };
  }

  if (tool === 'search_facebook_leads') {
    const query = String(args.query || args.q || args.name || '').trim();
    if (!query) {
      return { tool, success: false, summary: 'Provide a search query (name, email, company, or phone).' };
    }
    const { searchFacebookLeads } = await import('@/services/facebookLeadSearchService');
    const data = await searchFacebookLeads(tenantId, query);
    const allLeads = [...(data.local || []), ...(data.graph || [])];
    const leadDetails = allLeads.slice(0, 5).map((lead: { name?: string; full_name?: string; email?: string }) =>
      `- ${lead.name || lead.full_name || 'Unknown'} (${lead.email || 'no email'})`
    ).join('\n') || 'No leads found';

    return {
      tool,
      success: true,
      summary: `Found ${data.total} Facebook lead match(es) for "${query}".`,
      details: leadDetails,
    };
  }

  if (tool === 'draft_reply') {
    const prompt = String(args.prompt || args.context || '').trim();
    if (!prompt) {
      return { tool, success: false, summary: 'Provide prompt or context for draft_reply.' };
    }
    const text = await callDeepSeek(prompt, {
      model: 'deepseek-chat',
      maxTokens: 1200,
      temperature: 0.5,
      systemPrompt:
        'You are Bonnie AI support copilot. Draft professional, empathetic customer replies. Return only the reply text — no subject lines or markdown.',
    });
    return { tool, success: true, summary: 'Draft reply generated.', details: text.trim() };
  }

  if (tool === 'summarize_ticket') {
    const prompt = String(args.prompt || args.context || '').trim();
    if (!prompt) {
      return { tool, success: false, summary: 'Provide ticket context for summarize_ticket.' };
    }
    const text = await callDeepSeek(prompt, {
      model: 'deepseek-chat',
      maxTokens: 800,
      temperature: 0.4,
      systemPrompt:
        'You are Bonnie AI support copilot. Summarize support tickets in 3 concise bullet points for the assigned agent. Plain text only.',
    });
    return { tool, success: true, summary: 'Ticket summary generated.', details: text.trim() };
  }

  if (tool === 'generate_outreach_draft') {
    const prompt = String(args.prompt || '').trim();
    if (!prompt) {
      return { tool, success: false, summary: 'Provide outreach context for generate_outreach_draft.' };
    }
    const text = await callDeepSeek(prompt, {
      model: 'deepseek-chat',
      maxTokens: 1500,
      temperature: 0.55,
      systemPrompt:
        'You are Bonnie AI outreach copilot. Generate personalized outreach email drafts. Return JSON: { "subject": "...", "body": "..." }',
    });
    return { tool, success: true, summary: 'Outreach draft generated.', details: text.trim() };
  }

  return { tool, success: false, summary: `Unknown custom tool: ${tool}` };
}
