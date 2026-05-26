import { z } from 'zod';

export interface MCPToolContext {
  tenantId: string;
  userId: string;
}

export interface MCPTool<T extends z.ZodObject<any> = z.ZodObject<any>> {
  name: string;
  description: string;
  inputSchema: T;
  jsonSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  handler: (args: z.infer<T>, context: MCPToolContext) => Promise<any>;
}

export interface MCPToolExecutionResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}
