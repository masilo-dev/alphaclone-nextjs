export type BonnieToolCall = {
  tool: string;
  arguments?: Record<string, unknown>;
};

export type BonnieToolResult = {
  tool: string;
  success: boolean;
  summary: string;
  details?: string;
};
