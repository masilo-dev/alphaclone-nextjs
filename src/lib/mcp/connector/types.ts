/**
 * Shared types for the ChatGPT MCP connector surface.
 * Every connector tool returns a structured JSON envelope.
 */

export type ConnectorRole = 'owner' | 'admin' | 'member' | 'viewer' | 'guest';

export type ConnectorPermission =
  | 'platform:read'
  | 'platform:admin'
  | 'platform:restart'
  | 'audit:read'
  | 'audit:run'
  | 'bonnie:read'
  | 'bonnie:write'
  | 'bonnie:execute'
  | 'crm:read'
  | 'crm:write'
  | 'crm:delete'
  | 'social:read'
  | 'social:write'
  | 'social:publish'
  | 'marketing:read'
  | 'marketing:write'
  | 'sales:read'
  | 'sales:write'
  | 'calendar:read'
  | 'calendar:write'
  | 'documents:read'
  | 'documents:write'
  | 'reports:read'
  | 'operations:read'
  | 'integrations:read'
  | 'integrations:write'
  | 'contracts:read'
  | 'contracts:write'
  | 'support:read'
  | 'support:write'
  | 'accounting:read'
  | 'accounting:write';

export type PaginationInput = {
  limit?: number;
  offset?: number;
  cursor?: string | null;
};

export type PaginationMeta = {
  limit: number;
  offset: number;
  total: number | null;
  has_more: boolean;
  next_offset: number | null;
  next_cursor: string | null;
};

export type ActionReceipt = {
  action_id: string;
  status: string;
  provider?: string | null;
  provider_reference?: string | null;
  timestamp: string;
  entity_id?: string | null;
  entity_type?: string | null;
  live_url?: string | null;
  verification?: Record<string, unknown>;
  rollback_available?: boolean;
  retry_available?: boolean;
};

export type ConnectorSuccess<T> = {
  ok: true;
  tool: string;
  data: T;
  receipt?: ActionReceipt | null;
  error?: null;
  pagination?: PaginationMeta;
  meta?: Record<string, unknown>;
};

export type ConnectorErrorBody = {
  ok: false;
  tool: string;
  data?: null;
  receipt?: null;
  error: {
    code: string;
    message: string;
    retryable?: boolean;
    approval_id?: string;
    details?: unknown;
  };
  meta?: Record<string, unknown>;
};

export type ConnectorResult<T> = ConnectorSuccess<T> | ConnectorErrorBody;

export type AuditFindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type AuditFinding = {
  id: string;
  module: string;
  severity: AuditFindingSeverity;
  title: string;
  detail: string;
  recommendation: string;
  evidence?: Record<string, unknown>;
};

export type PlatformHealthScore = {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  summary: string;
  findings: AuditFinding[];
  recommendations: string[];
  modules: Record<
    string,
    {
      status: 'healthy' | 'degraded' | 'failing' | 'unknown';
      score: number;
      finding_count: number;
    }
  >;
  generated_at: string;
};
