import config from '@/config/knownBrokenTools.json';

export type BrokenToolAction =
  | 'redirect'
  | 'sanitize_args'
  | 'chunk'
  | 'block_automation'
  | 'block_with_hint';

export type BrokenToolEntry = {
  symptom: string;
  action: BrokenToolAction;
  reason: string;
  workaround: {
    tool?: string;
    argMap?: Record<string, string>;
    stripArgs?: string[];
    chunkSize?: number;
    listArg?: string;
  } | null;
};

const BROKEN_TOOLS = config as Record<string, BrokenToolEntry>;

export function getBrokenToolConfig(toolName: string): BrokenToolEntry | null {
  return BROKEN_TOOLS[toolName] ?? null;
}

export function isAutomationBlockedTool(toolName: string): boolean {
  const entry = getBrokenToolConfig(toolName);
  return entry?.action === 'block_automation';
}

export function resolveToolWorkaround(
  toolName: string,
  args: Record<string, unknown>
): { toolName: string; args: Record<string, unknown>; redirected: boolean; note?: string } {
  const entry = getBrokenToolConfig(toolName);
  if (!entry) return { toolName, args, redirected: false };

  if (entry.action === 'sanitize_args' && entry.workaround?.stripArgs?.length) {
    const next = { ...args };
    for (const key of entry.workaround.stripArgs) {
      delete next[key];
    }
    return { toolName, args: next, redirected: false, note: entry.reason };
  }

  if (entry.action === 'redirect' && entry.workaround?.tool) {
    const mapped: Record<string, unknown> = { ...args };
    if (entry.workaround.argMap) {
      for (const [from, to] of Object.entries(entry.workaround.argMap)) {
        if (args[from] !== undefined) mapped[to] = args[from];
      }
    }
    return {
      toolName: entry.workaround.tool,
      args: mapped,
      redirected: true,
      note: `${toolName} redirected: ${entry.reason}`,
    };
  }

  if (entry.action === 'block_with_hint') {
    throw new Error(`[known_broken_tool] ${toolName}: ${entry.reason}`);
  }

  if (entry.action === 'block_automation') {
    throw new Error(`[known_broken_tool] ${toolName}: ${entry.reason}`);
  }

  return { toolName, args, redirected: false };
}

export function shouldChunkOutreach(toolName: string): { chunkSize: number; listArg: string } | null {
  const entry = getBrokenToolConfig(toolName);
  if (entry?.action !== 'chunk' || !entry.workaround?.chunkSize || !entry.workaround.listArg) {
    return null;
  }
  return { chunkSize: entry.workaround.chunkSize, listArg: entry.workaround.listArg };
}

const TRANSIENT_ERROR = /timeout|timed out|5\d\d|ECONNRESET|ETIMEDOUT|temporarily unavailable|rate limit/i;

export function isTransientToolError(message: string): boolean {
  return TRANSIENT_ERROR.test(message);
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
