export type ClientCapabilities = {
  protocolVersion: string;
  supportsTools: boolean;
  supportsResources: boolean;
  supportsPrompts: boolean;
  supportsProgress: boolean;
  supportsTasks: boolean;
  supportsFileUpload: boolean;
  supportsBinaryContent: boolean;
  supportsBase64: boolean;
  supportsUrlInput: boolean;
  supportsImageOutput: boolean;
  supportsVideoOutput: boolean;
  supportsStructuredContent: boolean;
  maxToolCount?: number;
  maxSchemaSize?: number;
  maxRequestBytes?: number;
  maxResponseBytes?: number;
};

export type ClientAdapter = {
  id: string;
  matches(clientName: string, userAgent?: string | null): boolean;
  negotiate(protocolVersion: string, advertised?: Record<string, unknown>): ClientCapabilities;
};

const base = (protocolVersion: string): ClientCapabilities => ({
  protocolVersion,
  supportsTools: true,
  supportsResources: false,
  supportsPrompts: false,
  supportsProgress: false,
  supportsTasks: false,
  supportsFileUpload: false,
  supportsBinaryContent: false,
  supportsBase64: true,
  supportsUrlInput: true,
  supportsImageOutput: false,
  supportsVideoOutput: false,
  supportsStructuredContent: true,
  maxToolCount: 32,
  maxRequestBytes: 10 * 1024 * 1024,
  maxResponseBytes: 4 * 1024 * 1024,
});

const profiles: Record<string, Partial<ClientCapabilities>> = {
  chatgpt: { supportsResources: true, supportsFileUpload: true, supportsImageOutput: true },
  claude: { supportsResources: true, supportsPrompts: true, supportsProgress: true },
  claude_code: { supportsResources: true, supportsPrompts: true, supportsProgress: true, supportsTasks: true },
  cursor: { supportsResources: true },
  codex: { supportsResources: true, supportsProgress: true, supportsTasks: true, supportsFileUpload: true },
  amazon_q: {},
  bedrock: { supportsTasks: true },
  generic_mcp: {},
};

export function identifyClient(clientName = '', userAgent = ''): keyof typeof profiles {
  const value = `${clientName} ${userAgent}`.toLowerCase();
  if (value.includes('claude code')) return 'claude_code';
  if (value.includes('claude')) return 'claude';
  if (value.includes('chatgpt')) return 'chatgpt';
  if (value.includes('cursor')) return 'cursor';
  if (value.includes('codex')) return 'codex';
  if (value.includes('amazon q')) return 'amazon_q';
  if (value.includes('bedrock')) return 'bedrock';
  return 'generic_mcp';
}

export function negotiateClientCapabilities(input: {
  protocolVersion: string;
  clientName?: string;
  userAgent?: string | null;
  advertised?: Record<string, any>;
}): ClientCapabilities {
  const kind = identifyClient(input.clientName, input.userAgent || '');
  const advertised = input.advertised || {};
  return {
    ...base(input.protocolVersion),
    ...profiles[kind],
    supportsResources: Boolean(advertised.resources ?? profiles[kind].supportsResources),
    supportsPrompts: Boolean(advertised.prompts ?? profiles[kind].supportsPrompts),
    supportsProgress: Boolean(advertised.progress ?? profiles[kind].supportsProgress),
    supportsTasks: Boolean(advertised.tasks ?? profiles[kind].supportsTasks),
  };
}
