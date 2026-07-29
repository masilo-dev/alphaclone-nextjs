/**
<<<<<<< HEAD
 * MCP Agent Workflow — durable multi-step Bonnie agent execution.
 */
export async function mcpAgentWorkflow({
  prompt,
  tenantId,
  userId,
  lifecycleTool,
}: {
  prompt: string;
  tenantId: string;
  userId?: string;
  lifecycleTool?: string;
}) {
  'use workflow';

  const runId = await createWorkflowRunStep({ prompt, tenantId, userId: userId || tenantId });
  const plan = await planBonnieMissionStep({ prompt, tenantId, userId: userId || tenantId, lifecycleTool });
  const execution = await executeBonnieToolsStep({
    tenantId,
    userId: userId || tenantId,
    instruction: prompt,
    toolCalls: plan.toolCalls,
    prefetchedResponse: plan.prefetchedResponse,
    prefetchedToolResults: plan.prefetchedToolResults,
  });
  const verification = await verifyBonnieMissionStep({
    tenantId,
    userId: userId || tenantId,
    lifecycleTool: plan.lifecycleTool,
    toolResults: execution.toolResults,
  });
  const synthesis = await synthesizeBonnieMissionStep({
    prompt,
    toolResults: execution.toolResults,
    verification,
    prefetchedResponse: plan.prefetchedResponse,
  });

  await finalizeWorkflowRunStep({
    runId,
    tenantId,
    plannedActions: plan.toolCalls,
    executionResults: execution.toolResults,
    status: synthesis.success ? 'completed' : 'partial',
  });

  return {
    runId,
    response: synthesis.response,
    success: synthesis.success,
    toolResults: execution.toolResults,
    verification,
    rounds: plan.rounds,
    logs: [...plan.logs, ...execution.logs, ...verification.logs],
  };
}

async function createWorkflowRunStep(params: {
  prompt: string;
  tenantId: string;
  userId: string;
}) {
  'use step';

  const { createSupabaseAdminClient } = await import('@/lib/supabase-admin');
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('nexus_orchestration_runs')
    .insert({
      tenant_id: params.tenantId,
      user_id: params.userId,
      task: params.prompt,
      status: 'running',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || 'Failed to create workflow run');
  }

  return data.id as string;
}

async function finalizeWorkflowRunStep(params: {
  runId: string;
  tenantId: string;
  plannedActions: unknown[];
  executionResults: unknown[];
  status: 'completed' | 'partial' | 'failed';
}) {
  'use step';

  const { createSupabaseAdminClient } = await import('@/lib/supabase-admin');
  const supabase = createSupabaseAdminClient();
  await supabase
    .from('nexus_orchestration_runs')
    .update({
      planned_actions: params.plannedActions,
      execution_results: params.executionResults,
      status: params.status,
      completed_at: new Date().toISOString(),
    })
    .eq('id', params.runId)
    .eq('tenant_id', params.tenantId);
}

async function planBonnieMissionStep(params: {
  prompt: string;
  tenantId: string;
  userId: string;
  lifecycleTool?: string;
}) {
  'use step';

  const lifecycleMatchers: Array<{ re: RegExp; tool: string }> = [
    { re: /\binvoice lifecycle\b/i, tool: 'start_invoice_lifecycle' },
    { re: /\bcontract lifecycle\b/i, tool: 'start_contract_lifecycle' },
    { re: /\blead (nurture|campaign)\b/i, tool: 'start_lead_campaign' },
  ];

  let lifecycleTool = params.lifecycleTool;
  if (!lifecycleTool) {
    for (const matcher of lifecycleMatchers) {
      if (matcher.re.test(params.prompt)) {
        lifecycleTool = matcher.tool;
        break;
      }
    }
  }

  if (lifecycleTool) {
    return {
      toolCalls: [{ tool: lifecycleTool, arguments: { tenant_id: params.tenantId } }],
      lifecycleTool,
      rounds: 1,
      logs: [`Lifecycle mission detected: ${lifecycleTool}`],
    };
  }

  const { runBonnieAgent } = await import('@/lib/bonnie/bonnieAgent');
  const agentResult = await runBonnieAgent({
    tenantId: params.tenantId,
    userId: params.userId,
    instruction: params.prompt,
  });

  return {
    toolCalls: [],
    lifecycleTool: undefined,
    rounds: agentResult.rounds,
    logs: agentResult.logs,
    prefetchedResponse: agentResult.response,
    prefetchedToolResults: agentResult.toolResults,
  };
}

async function executeBonnieToolsStep(params: {
  tenantId: string;
  userId: string;
  instruction: string;
  toolCalls: Array<{ tool: string; arguments?: Record<string, unknown> }>;
  prefetchedResponse?: string;
  prefetchedToolResults?: Array<{ tool: string; success: boolean; summary: string }>;
}) {
  'use step';

  if (params.prefetchedToolResults?.length) {
    return {
      toolResults: params.prefetchedToolResults,
      logs: ['Used agent execution from plan step'],
    };
  }

  if (params.prefetchedResponse && params.toolCalls.length === 0) {
    return { toolResults: [], logs: ['Used agent plan without additional execution'] };
  }

  const { executeBonnieToolCalls } = await import('@/lib/bonnie/bonnieToolExecutor');
  const toolResults = await executeBonnieToolCalls(
    params.tenantId,
    params.userId,
    params.toolCalls,
    params.instruction
  );

  return {
    toolResults,
    logs: toolResults.map((r) => `${r.success ? '✓' : '✗'} ${r.tool}: ${r.summary}`),
  };
}

async function verifyBonnieMissionStep(params: {
  tenantId: string;
  userId: string;
  lifecycleTool?: string;
  toolResults: Array<{ tool: string; success: boolean; summary: string }>;
}) {
  'use step';

  const logs: string[] = [];
  if (!params.lifecycleTool) {
    return { verified: true, logs: ['No lifecycle verification required'] };
  }

  const verifyTools: Record<string, string> = {
    start_invoice_lifecycle: 'verify_invoice_sent',
    start_contract_lifecycle: 'get_contract_approvals',
    start_lead_campaign: 'verify_outreach_delivery',
  };

  const verifyTool = verifyTools[params.lifecycleTool];
  if (!verifyTool) {
    return { verified: true, logs: ['No verify tool mapped for lifecycle'] };
  }

  const { executeSingleBonnieTool } = await import('@/lib/bonnie/executeSingleBonnieTool');
  const result = await executeSingleBonnieTool({
    tenantId: params.tenantId,
    userId: params.userId,
    tool: verifyTool,
    args: { tenant_id: params.tenantId },
    instruction: `Verify ${params.lifecycleTool}`,
  });

  logs.push(`Verification ${verifyTool}: ${result.summary}`);
  return { verified: result.success, verifyTool, result, logs };
}

async function synthesizeBonnieMissionStep(params: {
  prompt: string;
  toolResults: Array<{ tool: string; success: boolean; summary: string }>;
  verification: { verified?: boolean; logs?: string[] };
  prefetchedResponse?: string;
}) {
  'use step';

  if (params.prefetchedResponse && params.toolResults.length === 0) {
    return { response: params.prefetchedResponse, success: true };
  }

  const lines = params.toolResults.map((r) => `- ${r.success ? '✓' : '✗'} ${r.tool}: ${r.summary}`);
  const verificationLine = params.verification.verified === false
    ? 'Verification did not fully confirm completion.'
    : 'Verification passed or was not required.';

  return {
    response: `Mission complete for: ${params.prompt}\n\n${lines.join('\n')}\n\n${verificationLine}`,
    success: params.toolResults.every((r) => r.success) && params.verification.verified !== false,
  };
=======
 * MCP Agent Workflow
 * A durable AI agent that can run long-running tasks.
 */
export async function mcpAgentWorkflow({ prompt, tenantId }: { prompt: string; tenantId: string }) {
  "use workflow";
  
  // Logic for a durable agent
  // This uses the workflow context to maintain state across steps
  
  const result = `Mock result for: ${prompt}`;

  console.log(`Agent result for tenant ${tenantId}: ${result}`);
  return result;
>>>>>>> origin/main
}
