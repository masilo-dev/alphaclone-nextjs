/**
 * MCP adapter for the domain external write primitive.
 * Business guarantees live in `@/lib/execution/domainExternalWrite`.
 */

import type { PolicySource } from '@/lib/ai/ToolPolicyGate';
import {
  executeDomainExternalWrite,
  mapServiceErrorCode,
  type ExecuteDomainExternalWriteParams,
  type ExecuteDomainExternalWriteResult,
  type ExecutionMode,
  type ExecutionTarget,
  type DomainExecutionError,
} from '@/lib/execution/domainExternalWrite';

export type {
  ExecutionMode,
  ExecutionTarget,
  DomainExecutionError as McpExecutionError,
};

export type ExecuteMcpWriteParams<TResult> = Omit<
  ExecuteDomainExternalWriteParams<TResult>,
  'capability' | 'executionSource'
> & {
  tool: string;
  executionSource?: PolicySource | string;
  mirrorToDurableRuntime?: boolean;
};

export type ExecuteMcpWriteResult<TResult> = ExecuteDomainExternalWriteResult<TResult>;

export async function executeMcpWrite<TResult>(
  params: ExecuteMcpWriteParams<TResult>
): Promise<ExecuteMcpWriteResult<TResult>> {
  const { tool, executionSource = 'mcp', ...rest } = params;
  return executeDomainExternalWrite({
    ...rest,
    capability: tool,
    executionSource,
  });
}

export { mapServiceErrorCode };
