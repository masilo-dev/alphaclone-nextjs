/**
 * Curated open-source / architecture watchlist for Bonnie Research.
 * Bonnie evaluates these continuously and recommends adopt / integrate / skip.
 */

export type ResearchCategory =
  | 'agents'
  | 'memory'
  | 'orchestration'
  | 'observability'
  | 'browser'
  | 'mcp'
  | 'data'
  | 'ui'
  | 'evaluation';

export type ResearchRecommendation = 'adopt' | 'integrate' | 'watch' | 'skip' | 'replace';

export type ResearchTarget = {
  id: string;
  name: string;
  repo?: string;
  category: ResearchCategory;
  purpose: string;
  whyItMatters: string;
  alphacloneFit: string;
  defaultRecommendation: ResearchRecommendation;
  priority: number;
};

export const BONNIE_RESEARCH_CATALOG: ResearchTarget[] = [
  {
    id: 'langgraph',
    name: 'LangGraph',
    repo: 'langchain-ai/langgraph',
    category: 'agents',
    purpose: 'Stateful multi-agent graphs with durable execution',
    whyItMatters: 'Production pattern for plan → tool → verify loops',
    alphacloneFit: 'Compare with Bonnie ReAct loop and Temporal workflows',
    defaultRecommendation: 'watch',
    priority: 1,
  },
  {
    id: 'openai-agents-sdk',
    name: 'OpenAI Agents SDK',
    repo: 'openai/openai-agents-python',
    category: 'agents',
    purpose: 'Official agent primitives, handoffs, and tracing',
    whyItMatters: 'Reference for tool schemas and handoff UX',
    alphacloneFit: 'Borrow handoff + tracing ideas without rewriting Bonnie',
    defaultRecommendation: 'integrate',
    priority: 1,
  },
  {
    id: 'mastra',
    name: 'Mastra',
    repo: 'mastra-ai/mastra',
    category: 'agents',
    purpose: 'TypeScript agent framework with workflows and memory',
    whyItMatters: 'Closest stack fit to Next.js/TS AlphaClone',
    alphacloneFit: 'Evaluate workflow primitives vs current Bonnie tool executor',
    defaultRecommendation: 'watch',
    priority: 1,
  },
  {
    id: 'mem0',
    name: 'Mem0',
    repo: 'mem0ai/mem0',
    category: 'memory',
    purpose: 'Long-term memory layer for agents',
    whyItMatters: 'Persistent cross-session business memory',
    alphacloneFit: 'Extend Bonnie warm context / tenant memory without cloning',
    defaultRecommendation: 'integrate',
    priority: 1,
  },
  {
    id: 'graphiti',
    name: 'Graphiti',
    repo: 'getzep/graphiti',
    category: 'memory',
    purpose: 'Temporal knowledge graphs for agent memory',
    whyItMatters: 'Business digital twin / relationship memory',
    alphacloneFit: 'CRM + deal + project knowledge graph explorer',
    defaultRecommendation: 'watch',
    priority: 2,
  },
  {
    id: 'temporal',
    name: 'Temporal',
    repo: 'temporalio/temporal',
    category: 'orchestration',
    purpose: 'Durable workflow engine',
    whyItMatters: 'Reliable long-running business processes',
    alphacloneFit: 'Already used for invoice lifecycle — deepen usage',
    defaultRecommendation: 'adopt',
    priority: 1,
  },
  {
    id: 'trigger-dev',
    name: 'Trigger.dev',
    repo: 'triggerdotdev/trigger.dev',
    category: 'orchestration',
    purpose: 'Background jobs for TypeScript apps',
    whyItMatters: 'Simpler DX for scheduled agent research scans',
    alphacloneFit: 'Candidate for Bonnie research cron + dream cycles',
    defaultRecommendation: 'watch',
    priority: 2,
  },
  {
    id: 'langfuse',
    name: 'Langfuse',
    repo: 'langfuse/langfuse',
    category: 'observability',
    purpose: 'LLM observability, traces, evaluations',
    whyItMatters: 'Auditable agent reasoning and cost',
    alphacloneFit: 'Wire into Bonnie audit center / cost dashboard',
    defaultRecommendation: 'integrate',
    priority: 1,
  },
  {
    id: 'opentelemetry',
    name: 'OpenTelemetry',
    category: 'observability',
    purpose: 'Vendor-neutral traces and metrics',
    whyItMatters: 'Enterprise observability baseline',
    alphacloneFit: 'Unify Bonnie tool calls, workflows, and API spans',
    defaultRecommendation: 'adopt',
    priority: 1,
  },
  {
    id: 'browser-use',
    name: 'Browser Use',
    repo: 'browser-use/browser-use',
    category: 'browser',
    purpose: 'AI-driven browser automation',
    whyItMatters: 'Research + enrichment actions outside APIs',
    alphacloneFit: 'Compare with Playwright + Stagehand scrapers',
    defaultRecommendation: 'watch',
    priority: 2,
  },
  {
    id: 'stagehand',
    name: 'Stagehand',
    repo: 'browserbase/stagehand',
    category: 'browser',
    purpose: 'AI browser control on Playwright',
    whyItMatters: 'Reliable web actions with LLM guidance',
    alphacloneFit: 'Lead enrichment and public research tools',
    defaultRecommendation: 'integrate',
    priority: 2,
  },
  {
    id: 'fastmcp',
    name: 'FastMCP',
    repo: 'jlowin/fastmcp',
    category: 'mcp',
    purpose: 'Rapid MCP server authoring',
    whyItMatters: 'Expand Bonnie tool surface as MCP tools',
    alphacloneFit: 'Standardize Bonnie MCP bridge tool packaging',
    defaultRecommendation: 'integrate',
    priority: 1,
  },
  {
    id: 'qdrant',
    name: 'Qdrant',
    repo: 'qdrant/qdrant',
    category: 'data',
    purpose: 'Vector search engine',
    whyItMatters: 'Semantic retrieval for knowledge + memory',
    alphacloneFit: 'Knowledge base + Bonnie retrieval layer',
    defaultRecommendation: 'watch',
    priority: 2,
  },
  {
    id: 'supabase',
    name: 'Supabase',
    repo: 'supabase/supabase',
    category: 'data',
    purpose: 'Postgres + auth + storage platform',
    whyItMatters: 'Current AlphaClone data backbone',
    alphacloneFit: 'Keep as system of record; deepen RLS + realtime',
    defaultRecommendation: 'adopt',
    priority: 1,
  },
  {
    id: 'e2b',
    name: 'E2B',
    repo: 'e2b-dev/E2B',
    category: 'evaluation',
    purpose: 'Secure cloud sandboxes for agents',
    whyItMatters: 'Safe code execution and eval harnesses',
    alphacloneFit: 'Sandbox Bonnie code tools and research experiments',
    defaultRecommendation: 'watch',
    priority: 3,
  },
];

export type ResearchFinding = {
  targetId: string;
  name: string;
  category: ResearchCategory;
  recommendation: ResearchRecommendation;
  summary: string;
  advantages: string[];
  risks: string[];
  integrationDifficulty: 'low' | 'medium' | 'high';
  businessValue: 'high' | 'medium' | 'low';
  nextAction: string;
};

export type ResearchBriefing = {
  generatedAt: string;
  findings: ResearchFinding[];
  priorities: string[];
  architecturePrinciples: string[];
};
