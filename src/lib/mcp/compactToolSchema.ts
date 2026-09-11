/**
 * Compact MCP tool schemas for tools/list discovery.
 *
 * Claude.ai / Desktop / Code silently drop oversized catalogs (connected + 0 tools).
 * We keep the FULL platform tool list and shrink each entry so the payload fits.
 * Server-side Zod validation still enforces full schemas on tools/call.
 */

const SESSION_FIELDS = new Set(['tenant_id', 'user_id', 'tenantId', 'userId']);

const MAX_DESCRIPTION_CHARS = 140;
const MAX_ENUM_VALUES = 8;
const VALID_JSON_SCHEMA_TYPES = new Set([
  'string',
  'number',
  'integer',
  'boolean',
  'object',
  'array',
  'null',
]);

function normalizePropertyType(raw: unknown): string {
  if (typeof raw === 'string' && VALID_JSON_SCHEMA_TYPES.has(raw)) return raw;
  if (Array.isArray(raw) && typeof raw[0] === 'string' && VALID_JSON_SCHEMA_TYPES.has(raw[0])) {
    return raw[0];
  }
  return 'string';
}

function truncateDescription(text: string | undefined): string {
  const cleaned = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'AlphaClone platform tool';
  if (cleaned.length <= MAX_DESCRIPTION_CHARS) return cleaned;
  return `${cleaned.slice(0, MAX_DESCRIPTION_CHARS - 3)}...`;
}

function compactProperty(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { type: 'string' };
  }
  const prop = raw as Record<string, unknown>;
  const compact: Record<string, unknown> = {};

  const normalizedType = normalizePropertyType(prop.type);
  compact.type = normalizedType;

  // Invalid manifests sometimes put human text in `type` — preserve it as description.
  if (
    typeof prop.type === 'string' &&
    !VALID_JSON_SCHEMA_TYPES.has(prop.type) &&
    !compact.description
  ) {
    compact.description = prop.type;
  } else if (typeof prop.description === 'string' && prop.description.trim()) {
    compact.description = prop.description;
  }

  if (Array.isArray(prop.enum) && prop.enum.length > 0 && prop.enum.length <= MAX_ENUM_VALUES) {
    compact.enum = prop.enum;
  }

  if (prop.items && typeof prop.items === 'object' && !Array.isArray(prop.items)) {
    const items = prop.items as Record<string, unknown>;
    compact.items = { type: normalizePropertyType(items.type) };
  }

  // Intentionally omit property descriptions / examples / oneOf / $ref — biggest payload bloat.
  return compact;
}

/** Minimal JSON Schema for discovery — types + required only. */
export function compactJsonSchemaForDiscovery(
  schema: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') {
    return { type: 'object', properties: {} };
  }

  const propertiesIn = { ...((schema.properties as Record<string, unknown>) || {}) };
  for (const key of SESSION_FIELDS) {
    delete propertiesIn[key];
  }

  const properties: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(propertiesIn)) {
    properties[key] = compactProperty(raw);
  }

  const required = Array.isArray(schema.required)
    ? (schema.required as string[]).filter((f) => !SESSION_FIELDS.has(f) && f in properties)
    : [];

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

export function compactMcpToolForDiscovery<T extends {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  annotations?: unknown;
}>(tool: T): T {
  return {
    ...tool,
    description: truncateDescription(tool.description),
    inputSchema: compactJsonSchemaForDiscovery(tool.inputSchema),
  };
}

export function estimateToolsListBytes(tools: Array<{ name: string }>): number {
  return Buffer.byteLength(JSON.stringify({ tools }), 'utf8');
}
