import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ENV } from '@/config/env';
import { getGoogleCalendarTokens, upsertGoogleCalendarTokens } from '@/services/google/googleCalendarIntegrationService';

const exportTables = {
  contacts: 'contacts',
  invoices: 'business_invoices',
  deals: 'deals',
  documents: 'documents',
} as const;

function scalar(value: unknown): string | number | boolean | null {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value)
    ? value as string | number | boolean | null
    : JSON.stringify(value);
}

function csvCell(value: unknown): string {
  const rendered = value === null || value === undefined
    ? ''
    : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `"${rendered.replace(/"/g, '""')}"`;
}

function toCsv(rows: Record<string, unknown>[]): string {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [headers.map(csvCell).join(','), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(','))].join('\n');
}

async function googleAccessToken(userId: string, tenantId: string): Promise<string> {
  const admin = createSupabaseAdminClient();
  let tokens = await getGoogleCalendarTokens(admin, userId, tenantId);
  if (tokens.accessToken && tokens.expiresAt && new Date(tokens.expiresAt).getTime() > Date.now() + 300_000) {
    return tokens.accessToken;
  }
  if (!tokens.refreshToken || !ENV.GOOGLE_CLIENT_ID || !ENV.GOOGLE_CLIENT_SECRET) {
    throw new Error('Reconnect Google Workspace under Settings → Integrations to grant Drive access.');
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: ENV.GOOGLE_CLIENT_ID,
      client_secret: ENV.GOOGLE_CLIENT_SECRET,
      refresh_token: tokens.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description || 'Google authorization could not be refreshed.');
  const expiresAt = new Date(Date.now() + Number(payload.expires_in || 3600) * 1000).toISOString();
  await upsertGoogleCalendarTokens({
    userId,
    tenantId,
    accessToken: String(payload.access_token),
    refreshToken: tokens.refreshToken,
    expiresAt,
  });
  tokens = { ...tokens, accessToken: String(payload.access_token), expiresAt };
  return tokens.accessToken;
}

registerTool('google-workspace', {
  name: 'export_to_google_workspace',
  description: 'Export tenant contacts, invoices, deals, or documents to a real Google Sheet, Google Doc, or Drive JSON file.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    export_type: z.enum(['contacts', 'invoices', 'deals', 'documents']),
    destination: z.enum(['sheets', 'docs', 'drive']),
    title: z.string().trim().min(1).max(160).optional(),
    filters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      export_type: { type: 'string', enum: ['contacts', 'invoices', 'deals', 'documents'] },
      destination: { type: 'string', enum: ['sheets', 'docs', 'drive'] },
      title: { type: 'string' },
      filters: { type: 'object' },
    },
    required: ['tenant_id', 'export_type', 'destination'],
  },
  handler: async (args, context) => {
    const admin = createSupabaseAdminClient();
    let query = admin.from(exportTables[args.export_type]).select('*').eq('tenant_id', args.tenant_id).limit(1000);
    for (const [field, value] of Object.entries(args.filters || {})) {
      if (!/^[a-z][a-z0-9_]*$/i.test(field)) throw new Error(`Invalid filter field: ${field}`);
      query = value === null ? query.is(field, null) : query.eq(field, scalar(value));
    }
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data || []) as Record<string, unknown>[];
    if (!rows.length) throw new Error(`No ${args.export_type} matched the export criteria.`);

    const title = args.title || `AlphaClone ${args.export_type} export ${new Date().toISOString().slice(0, 10)}`;
    const content = args.destination === 'sheets'
      ? toCsv(rows)
      : args.destination === 'docs'
        ? rows.map((row, index) => `${index + 1}. ${Object.entries(row).map(([key, value]) => `${key}: ${scalar(value) ?? ''}`).join('\n')}`).join('\n\n')
        : JSON.stringify(rows, null, 2);
    const sourceMime = args.destination === 'sheets' ? 'text/csv' : args.destination === 'docs' ? 'text/plain' : 'application/json';
    const googleMime = args.destination === 'sheets'
      ? 'application/vnd.google-apps.spreadsheet'
      : args.destination === 'docs'
        ? 'application/vnd.google-apps.document'
        : 'application/json';
    const extension = args.destination === 'drive' ? '.json' : '';

    const form = new FormData();
    form.set('metadata', new Blob([JSON.stringify({ name: `${title}${extension}`, mimeType: googleMime })], { type: 'application/json' }));
    form.set('file', new Blob([content], { type: sourceMime }));
    const accessToken = await googleAccessToken(context.userId, args.tenant_id);
    const upload = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    const file = await upload.json().catch(() => ({}));
    if (!upload.ok) throw new Error(file.error?.message || 'Google Workspace export failed.');

    return {
      content: [{ type: 'text', text: JSON.stringify({ success: true, exported: rows.length, destination: args.destination, file }, null, 2) }],
    };
  },
});
