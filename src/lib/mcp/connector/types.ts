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
  | 'integrations:read'
  | 'integrations:write';

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

export type ConnectorSuccess<T> = {
  ok: true;
  tool: string;
  data: T;
  pagination?: PaginationMeta;
  meta?: Record<string, unknown>;
};

export type ConnectorErrorBody = {
  ok: false;
  tool: string;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
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
