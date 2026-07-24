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

  // Do not append a long session disclaimer onto every schema — that alone can push
  // Claude past undocumented tools/list size limits (connected + zero tools).
  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

export function mergeSessionArgs(
  args: Record<string, unknown>,
  ctx: { tenantId: string; userId: string }
): Record<string, unknown> {
  const merged = { ...args };

  // Session-scoped MCP: ignore client-supplied tenant/user IDs and bind from auth.
  // Prevents AUTHORIZATION_ERROR when agents echo tenant_id from stale tool schemas.
  if (ctx.tenantId) {
    delete merged.tenant_id;
    delete merged.tenantId;
    merged.tenant_id = ctx.tenantId;
  }

  if (ctx.userId) {
    delete merged.user_id;
    delete merged.userId;
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
