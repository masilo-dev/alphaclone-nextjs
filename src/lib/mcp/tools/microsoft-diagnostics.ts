// @ts-nocheck
import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

registerTool('microsoft', {
  name: 'microsoft_connection_diagnostic',
  description:
    'Checks whether Microsoft 365 is connected, whether the token needs refreshing, and gives a simple human-readable fix path.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
    },
    required: ['tenant_id'],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const userId = ctx?.userId || null;

    let query = supabase
      .from('microsoft_connections')
      .select('id, user_id, access_token, refresh_token, token_expiry, microsoft_email, display_name, created_at, updated_at');

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.order('updated_at', { ascending: false }).limit(1);
    if (error) throw error;

    const connection = Array.isArray(data) ? data[0] : data;
    const expiry = connection?.token_expiry ? new Date(connection.token_expiry).getTime() : 0;
    const needsRefresh = expiry ? Date.now() + 5 * 60 * 1000 >= expiry : true;

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          connected: Boolean(connection?.access_token),
          provider: 'microsoft_365',
          account: connection ? {
            email: connection.microsoft_email,
            display_name: connection.display_name,
            user_id: connection.user_id,
          } : null,
          token_status: !connection?.access_token
            ? 'not_connected'
            : needsRefresh
              ? 'needs_refresh_or_reconnect'
              : 'active',
          next_step: !connection?.access_token
            ? 'Connect Microsoft 365 again from Settings → Integrations.'
            : needsRefresh
              ? 'Refresh or reconnect Microsoft 365 so mail/calendar tasks keep working.'
              : 'Microsoft 365 looks connected and ready.',
        }, null, 2),
      }],
    };
  },
});
