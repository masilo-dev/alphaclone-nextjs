/** Strip session-resolved IDs so MCP clients stop asking for tenant/user on every call. */
const SESSION_FIELDS = new Set(['tenant_id', 'user_id', 'tenantId', 'userId']);

export function sanitizeToolSchemaForClient(schema: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') return { type: 'object', properties: {} };

  const properties = { ...((schema.properties as Record<string, unknown>) || {}) };
  for (const key of SESSION_FIELDS) {
    delete properties[key];
  }

  const required = Array.isArray(schema.required)
    ? (schema.required as string[]).filter((f) => !SESSION_FIELDS.has(f))
    : [];

  return {
    ...schema,
    properties,
    required,
    description: schema.description
      ? `${schema.description} (Workspace and user are resolved from your MCP API key or OAuth session. CRM client_id is a contact UUID — use get_clients or search_email/search_name if unknown.)`
      : 'Workspace and user are resolved from your MCP API key or OAuth session. CRM client_id is a contact UUID — use get_clients or search_email/search_name if unknown.',
  };
}

export function mergeSessionArgs(
  args: Record<string, unknown>,
  ctx: { tenantId: string; userId: string }
): Record<string, unknown> {
  const merged = { ...args };

  if (ctx.tenantId) {
    const incoming = String(merged.tenant_id || '').trim();
    if (incoming && incoming !== ctx.tenantId) {
      throw new Error('tenant_id does not match authenticated workspace');
    }
    merged.tenant_id = ctx.tenantId;
  }

  if (ctx.userId) {
    const incoming = String(merged.user_id || '').trim();
    if (incoming && incoming !== ctx.userId) {
      throw new Error('user_id does not match authenticated user');
    }
    merged.user_id = ctx.userId;
  }

  return merged;
}

/** In-dashboard Bonnie: always bind tenant/user from the signed-in session. */
export function forceSessionArgs(
  args: Record<string, unknown>,
  ctx: { tenantId: string; userId: string }
): Record<string, unknown> {
  const merged = { ...args };
  if (ctx.tenantId) merged.tenant_id = ctx.tenantId;
  if (ctx.userId) merged.user_id = ctx.userId;
  return merged;
}
