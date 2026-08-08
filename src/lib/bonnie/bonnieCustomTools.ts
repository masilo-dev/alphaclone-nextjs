import { getBonnieWorkspaceSnapshot } from '@/lib/bonnie/bonnieWorkspaceSnapshot';
import { callDeepSeek } from '@/lib/ai/deepseek';
import type { BonnieToolResult } from '@/lib/bonnie/bonnieToolExecutor';

export async function executeCustomTool(
  tool: string,
  tenantId: string,
  userId: string,
  args: Record<string, unknown> = {}
): Promise<BonnieToolResult> {
  if (tool === 'delegate_to_hermes') {
    const prompt = String(args.prompt || args.task || args.instruction || args.goal || '').trim();
    if (!prompt) {
      return { tool, success: false, summary: 'Provide a prompt or task for Hermes.' };
    }

    const { createSupabaseAdminClient } = await import('@/lib/supabase-admin');
    const { dispatchHermesTask } = await import('@/lib/hermes/client');
    const { evaluateHermesPolicy, normalizeHermesPolicy } = await import('@/lib/hermes/policy');
    const policy = normalizeHermesPolicy(args.policy);
    const decision = evaluateHermesPolicy(policy);
    const sessionId = String(args.session_id || args.sessionId || '').trim();
    const conversationId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)
      ? sessionId
      : null;
    const admin = createSupabaseAdminClient();

    const { data: run, error } = await admin
      .from('agent_runs')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        conversation_id: conversationId,
        title: prompt.slice(0, 120),
        description: prompt,
        execution_mode: decision.requiresApproval ? 'approval_required' : 'semi_autonomous',
        status: decision.allowed ? 'pending' : 'waiting',
        progress_pct: 0,
        metadata: {
          runtime: 'hermes',
          source: 'bonnie_chat',
          policy,
          policyDecision: decision,
          prompt,
          sessionId: sessionId || null,
          requestedAt: new Date().toISOString(),
        },
      })
      .select('id, status, metadata')
      .single();

    if (error || !run) {
      return {
        tool,
        success: false,
        summary: `Hermes task could not be recorded: ${error?.message || 'unknown database error'}`,
      };
    }

    if (!decision.allowed) {
      return {
        tool,
        success: true,
        summary: decision.requiresApproval
          ? `Hermes task ${run.id} is waiting for approval before it runs.`
          : `Hermes task ${run.id} was held by policy: ${decision.reason}`,
        details: JSON.stringify({ runId: run.id, policy, decision }, null, 2),
      };
    }

    const dispatch = await dispatchHermesTask({
      tenantId,
      userId,
      taskId: run.id,
      sessionId: sessionId || undefined,
      prompt,
      metadata: { source: 'bonnie_chat', policy },
    });

    await admin
      .from('agent_runs')
      .update({
        status: dispatch.dispatched ? (dispatch.status === 'local_queued' ? 'planning' : 'pending') : 'failed',
        metadata: {
          ...(run.metadata || {}),
          hermes: dispatch,
          dispatchedAt: new Date().toISOString(),
        },
      })
      .eq('tenant_id', tenantId)
      .eq('id', run.id);

    return {
      tool,
      success: dispatch.dispatched,
      summary: dispatch.dispatched
        ? `Hermes task ${run.id} started from Bonnie chat.`
        : `Hermes task ${run.id} was recorded but could not start: ${dispatch.reason || dispatch.status}`,
      details: JSON.stringify({ runId: run.id, policy, dispatch }, null, 2),
    };
  }

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

  if (tool === 'get_account_overview') {
    const { bonnieGetAccountOverview } = await import('@/lib/bonnie/bonnieLeadOps');
    const overview = await bonnieGetAccountOverview(tenantId, userId);
    const int = overview.integrations;
    const summary = [
      `Facebook: ${int.facebook_pages.length ? int.facebook_pages.join(', ') : 'not connected'}`,
      `WhatsApp: ${int.whatsapp_connected ? 'connected' : 'not connected'}`,
      `Microsoft: ${int.microsoft_email || 'not connected'}`,
      `LinkedIn: ${int.linkedin_connected ? 'connected' : 'not connected'}`,
      `Scraper leads: ${overview.lead_ops.scraper_leads_count}`,
      `Active campaigns: ${overview.lead_ops.active_campaigns}`,
    ].join(' | ');

    return {
      tool,
      success: true,
      summary: `Full account overview loaded for tenant.`,
      details: JSON.stringify({ summary, overview }, null, 2).slice(0, 4000),
    };
  }

  if (tool === 'find_and_qualify_leads') {
    const { bonnieFindAndQualifyLeads } = await import('@/lib/bonnie/bonnieLeadOps');
    const niche = String(args.niche || args.business_type || args.industry || '').trim();
    const location = String(args.location || args.city || '').trim();
    const result = await bonnieFindAndQualifyLeads(tenantId, {
      niche,
      location,
      min_score: args.min_score != null ? Number(args.min_score) : undefined,
      tiers: Array.isArray(args.tiers) ? args.tiers : undefined,
      exclude_keywords: Array.isArray(args.exclude_keywords) ? args.exclude_keywords.map(String) : undefined,
      max_results: args.max_results != null ? Number(args.max_results) : undefined,
      save_to_crm: args.save_to_crm === true,
    });

    const hot = result.leads.filter((l) => l.tier === 'hot').length;
    return {
      tool,
      success: true,
      summary: `Found ${result.qualified_count} qualified leads (${hot} hot) for "${niche}" in ${location}.`,
      details: JSON.stringify(result, null, 2).slice(0, 4000),
    };
  }

  if (tool === 'parse_lead_criteria') {
    const message = String(args.criteria || args.message || args.instruction || '').trim();
    if (!message) {
      return { tool, success: false, summary: 'Describe your ideal lead criteria in natural language.' };
    }
    const { bonnieParseAndSaveLeadCriteria } = await import('@/lib/bonnie/bonnieLeadOps');
    const { intent, assistantReply } = await bonnieParseAndSaveLeadCriteria(tenantId, message);
    return {
      tool,
      success: true,
      summary: `Saved lead criteria: ${intent.summary || intent.search_query}`,
      details: JSON.stringify({ intent, assistantReply }, null, 2).slice(0, 3000),
    };
  }

  if (tool === 'qualify_crm_leads') {
    const { bonnieQualifyCrmLeads } = await import('@/lib/bonnie/bonnieLeadOps');
    const qualified = await bonnieQualifyCrmLeads(tenantId, {
      industry: args.industry ? String(args.industry) : undefined,
      min_score: args.min_score != null ? Number(args.min_score) : undefined,
      limit: args.limit != null ? Number(args.limit) : undefined,
      tiers: Array.isArray(args.tiers) ? args.tiers : undefined,
    });
    const hot = qualified.filter((l: { tier: string }) => l.tier === 'hot').length;
    return {
      tool,
      success: true,
      summary: `Qualified ${qualified.length} CRM leads (${hot} hot).`,
      details: JSON.stringify(qualified.slice(0, 20), null, 2).slice(0, 4000),
    };
  }

  if (tool === 'get_scraper_leads') {
    const { bonnieGetScraperLeads } = await import('@/lib/bonnie/bonnieLeadOps');
    const leads = await bonnieGetScraperLeads(tenantId, {
      min_score: args.min_score != null ? Number(args.min_score) : undefined,
      grade: args.grade ? String(args.grade) : undefined,
      limit: args.limit != null ? Number(args.limit) : undefined,
    });
    return {
      tool,
      success: true,
      summary: `Retrieved ${leads.length} scraper lead(s).`,
      details: JSON.stringify(leads.slice(0, 20), null, 2).slice(0, 4000),
    };
  }

  if (tool === 'get_customer_360') {
    const email = String(args.email || args.contact_email || '').trim();
    if (!email) return { tool, success: false, summary: 'Provide email for customer 360 view.' };
    const { bonnieGetCustomer360 } = await import('@/lib/bonnie/bonniePlatformOps');
    const profile = await bonnieGetCustomer360(tenantId, email);
    return {
      tool,
      success: true,
      summary: `Customer 360 for ${profile.primary_name || email}: LTV $${profile.lifetime_value}, ${profile.active_deals_count} active deals.`,
      details: JSON.stringify(profile, null, 2).slice(0, 4000),
    };
  }

  if (tool === 'get_integration_health') {
    const { bonnieGetIntegrationHealth } = await import('@/lib/bonnie/bonniePlatformOps');
    const health = await bonnieGetIntegrationHealth(tenantId, userId);
    return {
      tool,
      success: true,
      summary: health.healthy ? 'All core integrations connected.' : `${health.issues.length} integration issue(s) found.`,
      details: JSON.stringify(health, null, 2).slice(0, 3000),
    };
  }

  if (tool === 'get_proactive_brief') {
    const { bonnieGetProactiveBrief } = await import('@/lib/bonnie/bonniePlatformOps');
    const brief = await bonnieGetProactiveBrief(tenantId, userId);
    return {
      tool,
      success: true,
      summary: brief.attention_items.length
        ? brief.attention_items.join('; ')
        : 'Workspace looks healthy — no urgent items.',
      details: JSON.stringify(brief, null, 2).slice(0, 4000),
    };
  }

  if (tool === 'list_scraper_campaigns') {
    const { bonnieListScraperCampaigns } = await import('@/lib/bonnie/bonniePlatformOps');
    const campaigns = await bonnieListScraperCampaigns(tenantId);
    return {
      tool,
      success: true,
      summary: `${campaigns.length} scraper campaign(s) found.`,
      details: JSON.stringify(campaigns, null, 2).slice(0, 4000),
    };
  }

  if (tool === 'run_scraper_campaign') {
    const campaignId = String(args.campaign_id || args.id || '').trim();
    if (!campaignId) return { tool, success: false, summary: 'Provide campaign_id.' };
    const { bonnieRunScraperCampaign } = await import('@/lib/bonnie/bonniePlatformOps');
    const result = await bonnieRunScraperCampaign(tenantId, userId, campaignId);
    return {
      tool,
      success: true,
      summary: `Started campaign "${result.campaign?.name || campaignId}".`,
      details: JSON.stringify(result, null, 2).slice(0, 2000),
    };
  }

  if (tool === 'create_scraper_campaign') {
    const message = String(args.criteria || args.message || args.description || '').trim();
    if (!message) return { tool, success: false, summary: 'Describe the lead campaign you want.' };
    const { bonnieCreateScraperCampaignFromChat } = await import('@/lib/bonnie/bonniePlatformOps');
    const { campaign, intent } = await bonnieCreateScraperCampaignFromChat(tenantId, userId, message);
    return {
      tool,
      success: true,
      summary: `Created campaign "${campaign.name}" (min score ${campaign.min_score_threshold}).`,
      details: JSON.stringify({ campaign, intent }, null, 2).slice(0, 3000),
    };
  }

  if (tool === 'search_email_lead_context') {
    const email = String(args.email || args.from || '').trim();
    if (!email) return { tool, success: false, summary: 'Provide sender email.' };
    const { bonnieSearchEmailLeadContext } = await import('@/lib/bonnie/bonniePlatformOps');
    const ctx = await bonnieSearchEmailLeadContext(tenantId, email, args.subject ? String(args.subject) : undefined);
    return {
      tool,
      success: true,
      summary: `${ctx.matches.length} match(es) for ${ctx.email}.`,
      details: JSON.stringify(ctx, null, 2).slice(0, 4000),
    };
  }

  if (tool === 'ingest_content_to_lead') {
    const content = String(args.content || args.text || args.raw_content || '').trim();
    if (!content) return { tool, success: false, summary: 'Provide content to ingest.' };
    const { bonnieIngestContentToLead } = await import('@/lib/bonnie/bonniePlatformOps');
    const result = await bonnieIngestContentToLead(tenantId, content, {
      source: args.source ? String(args.source) : undefined,
      author_name: args.author_name ? String(args.author_name) : undefined,
      author_contact: args.author_contact ? String(args.author_contact) : undefined,
    });
    return {
      tool,
      success: true,
      summary: result.leadId
        ? `High-intent content ingested — lead created (${result.processed.intent_label}).`
        : `Content ingested (${result.processed.intent_label}, score ${result.processed.intent_score}).`,
      details: JSON.stringify(result, null, 2).slice(0, 3000),
    };
  }

  if (tool === 'get_autonomous_rules') {
    const { bonnieGetAutonomousRules } = await import('@/lib/bonnie/bonniePlatformOps');
    const rules = await bonnieGetAutonomousRules(tenantId);
    return {
      tool,
      success: true,
      summary: rules ? 'Autonomous runner rules loaded.' : 'No custom autonomous rules — using defaults.',
      details: JSON.stringify(rules || {}, null, 2).slice(0, 2000),
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
    if (snapshot.counts.contracts) summary.push(`${snapshot.counts.contracts} contracts`);
    if (snapshot.counts.campaigns) summary.push(`${snapshot.counts.campaigns} campaigns`);
    if (snapshot.counts.revenue_paid > 0) {
      summary.push(`$${Math.round(snapshot.counts.revenue_paid).toLocaleString()} revenue collected`);
    }
    if (snapshot.counts.revenue_outstanding > 0) {
      summary.push(`$${Math.round(snapshot.counts.revenue_outstanding).toLocaleString()} outstanding`);
    }

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
