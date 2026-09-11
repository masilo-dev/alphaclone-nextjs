export type SourceType =
  | 'manual'
  | 'alphaclone_ui'
  | 'bonnie'
  | 'mcp'
  | 'automation'
  | 'campaign_worker'
  | 'scheduled_workflow'
  | 'api'
  | 'system'
  | 'unknown';

export type SourceAgent =
  | 'User'
  | 'AlphaClone UI'
  | 'Bonnie'
  | 'ChatGPT'
  | 'Claude'
  | 'External MCP Client'
  | 'System'
  | 'Unknown';

export interface ActionAttribution {
  source_type: SourceType;
  source_agent: SourceAgent;
  source_tool?: string;
  source_provider?: string;
  initiated_by_user_id?: string;
  campaign_id?: string;
  job_id?: string;
  conversation_id?: string;
}

export function formatAttributionLabel(attribution: Partial<ActionAttribution>): string {
  const agent = attribution.source_agent || 'Unknown';
  const tool = attribution.source_tool;

  if (agent === 'ChatGPT' || agent === 'Claude') {
    const via = tool ? ` (${tool.replace(/_/g, ' ')})` : '';
    return `${agent} via AlphaClone MCP${via}`;
  }
  if (agent === 'Bonnie') return tool ? `Bonnie — ${tool.replace(/_/g, ' ')}` : 'Bonnie';
  if (agent === 'User' || attribution.source_type === 'manual') return 'Sent manually';
  if (attribution.source_type === 'campaign_worker') return 'Outreach campaign';
  if (attribution.source_type === 'automation') return 'Automation';
  if (attribution.source_type === 'scheduled_workflow') return 'Scheduled workflow';
  if (agent === 'System') return 'System';
  if (agent === 'Unknown' || !attribution.source_agent) return 'Source unavailable';
  return agent;
}

export function inferMcpAttribution(args: {
  toolName?: string;
  connectorHint?: string;
  userId?: string;
}): ActionAttribution {
  const hint = String(args.connectorHint || '').toLowerCase();
  let agent: SourceAgent = 'External MCP Client';
  if (hint.includes('chatgpt') || hint.includes('openai')) agent = 'ChatGPT';
  else if (hint.includes('claude') || hint.includes('anthropic')) agent = 'Claude';
  else if (hint.includes('bonnie')) agent = 'Bonnie';

  return {
    source_type: 'mcp',
    source_agent: agent,
    source_tool: args.toolName,
    initiated_by_user_id: args.userId,
  };
}

export function attributionFromMetadata(meta: Record<string, unknown> | null | undefined): ActionAttribution {
  if (!meta || typeof meta !== 'object') {
    return { source_type: 'unknown', source_agent: 'Unknown' };
  }
  return {
    source_type: (meta.source_type as SourceType) || (meta.source === 'mcp' ? 'mcp' : 'unknown'),
    source_agent: (meta.source_agent as SourceAgent) || 'Unknown',
    source_tool: meta.source_tool as string | undefined,
    source_provider: meta.source_provider as string | undefined,
    initiated_by_user_id: meta.initiated_by_user_id as string | undefined,
    campaign_id: meta.campaign_id as string | undefined,
    job_id: meta.job_id as string | undefined,
    conversation_id: meta.conversation_id as string | undefined,
  };
}
