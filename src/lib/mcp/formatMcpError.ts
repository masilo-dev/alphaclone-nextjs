import { ZodError } from 'zod';
import { standardError, type StandardMcpError } from '@/lib/mcp/standardResponse';

function firstIssueField(err: ZodError): string {
  const issue = err.issues[0];
  if (!issue) return 'input';
  const path = issue.path.filter((part) => part !== undefined && part !== null);
  return path.length ? path.map(String).join('.') : 'input';
}

/** Machine-readable validation errors for MCP clients (ChatGPT, Claude, Cursor). */
export function formatZodValidationError(tool: string, err: ZodError): StandardMcpError {
  const field = firstIssueField(err);
  const message = err.issues[0]?.message || 'Validation failed';
  return standardError(tool, 'VALIDATION_ERROR', `input.${field} is invalid: ${message}`, {
    retryable: false,
    details: {
      field,
      issues: err.issues.map((issue) => ({
        path: issue.path.map(String).join('.') || 'input',
        code: issue.code,
        message: issue.message,
      })),
    },
  });
}

export function formatQuotaExceededError(
  tool: string,
  params: {
    category: string;
    used: number;
    limit: number;
    resets_at?: string | null;
    message?: string;
  }
): StandardMcpError {
  return standardError(
    tool,
    'QUOTA_EXCEEDED',
    params.message || `Daily quota exceeded for ${params.category}.`,
    {
      retryable: true,
      details: {
        category: params.category,
        used: params.used,
        limit: params.limit,
        resets_at: params.resets_at || null,
      },
    }
  );
}

export function formatToolExecutionError(tool: string, err: unknown): StandardMcpError {
  if (err instanceof ZodError) {
    return formatZodValidationError(tool, err);
  }

  const e = err as Error & { code?: string; details?: unknown };
  const message = e?.message || 'Tool execution failed';
  const code = e?.code || 'TOOL_ERROR';
  const retryable =
    code === 'RATE_LIMITED' ||
    /timeout|transient|503|502|429|temporarily unavailable/i.test(message);

  if (code === 'CONFIRMATION_REQUIRED') {
    return standardError(tool, code, message, {
      retryable: true,
      details: e.details,
    });
  }

  return standardError(tool, code, message, {
    retryable,
    details: e.details,
  });
}

export function structuredErrorToMcpContent(result: StandardMcpError) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    isError: true,
  };
}
