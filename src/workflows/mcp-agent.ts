/**
 * MCP Agent Workflow — durable Bonnie agent execution.
 */
export async function mcpAgentWorkflow({
  prompt,
  tenantId,
  userId,
}: {
  prompt: string;
  tenantId: string;
  userId?: string;
}) {
  'use workflow';

  const result = await runBonnieAgentStep({ prompt, tenantId, userId: userId || tenantId });
  return result;
}

async function runBonnieAgentStep(params: {
  prompt: string;
  tenantId: string;
  userId: string;
}) {
  'use step';

  const { runBonnieAgent } = await import('@/lib/bonnie/bonnieAgent');
  const agentResult = await runBonnieAgent({
    tenantId: params.tenantId,
    userId: params.userId,
    instruction: params.prompt,
  });

  return {
    response: agentResult.response,
    success: agentResult.success,
    toolResults: agentResult.toolResults,
    rounds: agentResult.rounds,
    logs: agentResult.logs,
  };
}
