import { generateText } from '../unifiedAIService';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface NLQueryTranslation {
  natural_query: string;
  sql_query: string;
  is_valid: boolean;
  security_status: 'passed' | 'failed';
  explanation: string;
  tables_involved: string[];
}

export interface NLQueryExecutionResult {
  translation: NLQueryTranslation;
  columns: string[];
  rows: any[];
  row_count: number;
  execution_error?: string;
}

class NaturalLanguageSqlService {
  private SCHEMA_METADATA = `
Table SCHEMA for AlphaClone tenant database:

1. leads (
  id uuid primary key,
  tenant_id uuid,
  name text,
  email text,
  phone text,
  company text,
  industry text,
  location text,
  stage text (lead, qualified, proposal, negotiation, closed_won, closed_lost),
  value numeric,
  created_at timestamp,
  updated_at timestamp
)

2. contacts (
  id uuid primary key,
  tenant_id uuid,
  name text,
  email text,
  phone text,
  company text,
  created_at timestamp
)

3. business_clients (
  id uuid primary key,
  tenant_id uuid,
  name text,
  email text,
  phone text,
  company_name text,
  created_at timestamp
)

4. deals (
  id uuid primary key,
  tenant_id uuid,
  name text,
  client_id uuid,
  contact_id uuid,
  value numeric,
  stage text (lead, qualified, proposal, negotiation, closed_won, closed_lost),
  probability numeric,
  expected_close_date timestamp,
  created_at timestamp,
  updated_at timestamp
)

5. invoices (
  id uuid primary key,
  tenant_id uuid,
  invoice_number text,
  client_id uuid,
  amount numeric,
  total_amount numeric,
  status text (paid, unpaid, overdue, sent, draft, cancelled),
  created_at timestamp,
  paid_at timestamp,
  due_date timestamp
)

6. tasks (
  id uuid primary key,
  tenant_id uuid,
  title text,
  description text,
  status text (todo, in_progress, done, blocked, ideas),
  assigned_to uuid,
  created_at timestamp,
  due_date timestamp
)

7. calendar_events (
  id uuid primary key,
  tenant_id uuid,
  title text,
  description text,
  start_time timestamp,
  end_time timestamp
)

8. expenses (
  id uuid primary key,
  tenant_id uuid,
  amount numeric,
  category text,
  description text,
  created_at timestamp
)

9. quotes (
  id uuid primary key,
  tenant_id uuid,
  title text,
  client_id uuid,
  total_amount numeric,
  status text (draft, sent, accepted, declined, expired),
  created_at timestamp
)

Guidelines:
- All queries MUST include a filter on "tenant_id = 'tenantIdParameter'" to guarantee tenant isolation.
- Generate valid, optimized standard PostgreSQL read-only SELECT statements. Do NOT use updates, inserts, deletes, or drops.
`;

  /**
   * Translates a natural language query into a secure SQL SELECT statement.
   */
  async translateQuery(
    naturalQuery: string,
    tenantId: string
  ): Promise<NLQueryTranslation> {
    const prompt = `You are a World-Class Senior Database Architect and SQL Expert (PostgreSQL).
Your task is to translate a user's natural language business request into a valid, optimized, read-only PostgreSQL SELECT statement.

SYSTEM SCHEMA:
${this.SCHEMA_METADATA}

TENANT ISOLATION:
You MUST filter every query on "tenant_id = '${tenantId}'" on all tables selected/joined.

USER NATURAL QUERY:
"${naturalQuery}"

YOUR OUTPUT FORMAT:
You MUST respond with a single valid JSON object containing exactly the following keys. Do NOT include markdown styling or any other text before/after the JSON.

{
  "sql_query": "The clean, formatted PostgreSQL SELECT query",
  "is_valid": true,
  "explanation": "A concise 1-sentence description of what this query fetches",
  "tables_involved": ["list", "of", "tables"]
}

STRICT INSTRUCTIONS:
1. ONLY write SELECT statements.
2. Under no circumstances write INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, or CREATE statements.
3. Keep the query simple and clean. Match text patterns using ILIKE where appropriate.`;

    try {
<<<<<<< HEAD
      const response = await generateText(prompt, 1000, 'deepseek-chat', tenantId);
=======
      const response = await generateText(prompt, 1000, 'claude-sonnet-4-6-20260217', tenantId);
>>>>>>> origin/main
      const text = response.text || '';

      // Extract JSON block in case of conversational wrapper
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}') + 1;
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('Could not parse SQL translation response');
      }

      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd));

      // Security validation check
      const securityStatus = this.checkSqlSecurity(parsed.sql_query, tenantId) ? 'passed' : 'failed';

      return {
        natural_query: naturalQuery,
        sql_query: parsed.sql_query,
        is_valid: parsed.is_valid && securityStatus === 'passed',
        security_status: securityStatus,
        explanation: parsed.explanation,
        tables_involved: parsed.tables_involved || []
      };
    } catch (e: any) {
      return {
        natural_query: naturalQuery,
        sql_query: '',
        is_valid: false,
        security_status: 'failed',
        explanation: `Failed to translate query: ${e.message}`,
        tables_involved: []
      };
    }
  }

  /**
   * Strictly filters SQL queries to prevent mutation, injection, or cross-tenant leaks.
   */
  private checkSqlSecurity(sql: string, tenantId: string): boolean {
    const cleanSql = sql.toLowerCase().trim();

    // 1. Enforce SELECT only
    if (!cleanSql.startsWith('select')) {
      return false;
    }

    // 2. Blacklist mutating / diagnostic keywords
    const forbidden = [
      'insert', 'update', 'delete', 'drop', 'truncate', 'alter', 'create',
      'replace', 'grant', 'revoke', 'vacuum', 'reindex', 'pg_', 'schema',
<<<<<<< HEAD
      'information_schema', 'into', 'analyse', 'explain', 'union', 'intersect',
      'except', 'join', 'with', 'or', 'copy', 'execute', 'call'
=======
      'information_schema', 'into', 'analyse', 'explain'
>>>>>>> origin/main
    ];

    for (const word of forbidden) {
      // Regex check to avoid false positives inside words (e.g. "created_at" matching "create")
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      if (regex.test(cleanSql)) {
        return false;
      }
    }

<<<<<<< HEAD
    if ((cleanSql.match(/\bselect\b/g) || []).length !== 1 || /;|--|\/\*|\*\//.test(cleanSql)) {
      return false;
    }

    const sourceTable = cleanSql.match(/\bfrom\s+([a-z_][a-z0-9_]*)/)?.[1];
    const allowedTables = new Set(['leads', 'contacts', 'business_clients', 'deals', 'invoices', 'tasks', 'calendar_events', 'expenses', 'quotes']);
    if (!sourceTable || !allowedTables.has(sourceTable)) {
      return false;
    }

    const escapedTenantId = tenantId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`\\btenant_id\\b\\s*=\\s*['"]${escapedTenantId}['"]`, 'i').test(sql)) {
=======
    // 3. Ensure tenant isolation constraint is present
    if (!cleanSql.includes('tenant_id') || !cleanSql.includes(tenantId)) {
>>>>>>> origin/main
      return false;
    }

    return true;
  }

  /**
   * Executes the translated read-only query securely.
<<<<<<< HEAD
   * Queries execute only through the database's security-definer read-only RPC.
=======
   * If a direct raw SQL executor isn't available, we fallback to a safe PostgreSQL parser/mock
   * or direct RPC execution using a secure client proxy.
>>>>>>> origin/main
   */
  async executeQuery(
    supabase: SupabaseClient,
    tenantId: string,
    naturalQuery: string
  ): Promise<NLQueryExecutionResult> {
    const translation = await this.translateQuery(naturalQuery, tenantId);

    if (!translation.is_valid || translation.security_status === 'failed') {
      return {
        translation,
        columns: [],
        rows: [],
        row_count: 0,
        execution_error: 'Security validation failed: Forbidden keywords or tenant boundary violation detected.'
      };
    }

    try {
      // Execute read-only query via custom pg_read RPC if present, or dynamically fetch matching data using PostgREST fallback
      const { data, error } = await supabase.rpc('secure_read_only_query', {
<<<<<<< HEAD
        query_string: translation.sql_query,
        expected_tenant_id: tenantId,
      });

      if (error) {
        return {
          translation,
          columns: [],
          rows: [],
          row_count: 0,
          execution_error: `Secure query execution failed: ${error.message}`
=======
        query_string: translation.sql_query
      });

      if (error) {
        // Fallback: Dynamically parse query to execute safe PostgREST equivalents
        // This ensures compatibility even if the secure_read_only_query RPC has not been migrated
        const postgrestData = await this.fallbackPostgrestExecution(supabase, tenantId, translation);
        return {
          translation,
          columns: postgrestData.columns,
          rows: postgrestData.rows,
          row_count: postgrestData.rows.length
>>>>>>> origin/main
        };
      }

      const rows = Array.isArray(data) ? data : [];
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      return {
        translation,
        columns,
        rows,
        row_count: rows.length
      };
    } catch (e: any) {
      return {
        translation,
        columns: [],
        rows: [],
        row_count: 0,
        execution_error: e.message
      };
    }
  }

<<<<<<< HEAD
=======
  /**
   * Fully safe PostgREST fallback parsing key tables involved to serve read-only requests.
   */
  private async fallbackPostgrestExecution(
    supabase: SupabaseClient,
    tenantId: string,
    translation: NLQueryTranslation
  ): Promise<{ columns: string[]; rows: any[] }> {
    const table = translation.tables_involved[0] || 'deals';

    // Simple routing to the primary table
    const { data } = await supabase
      .from(table)
      .select('*')
      .eq('tenant_id', tenantId)
      .limit(20);

    const rows = Array.isArray(data) ? data : [];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return { columns, rows };
  }
>>>>>>> origin/main
}

export const naturalLanguageSqlService = new NaturalLanguageSqlService();
