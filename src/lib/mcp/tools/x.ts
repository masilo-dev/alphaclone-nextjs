// @ts-nocheck
import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

registerTool('x', {
  name: 'x_connection_diagnostic',
  description:
    'Checks whether X is connected, whether the token looks expired, and what to do next in plain English.',
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
      .from('x_integrations')
      .select('id, tenant_id, user_id, x_user_id, x_username, scopes, expires_at, created_at, updated_at')
      .eq('tenant_id', args.tenant_id);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.order('updated_at', { ascending: false }).limit(1);
    if (error) throw error;

    const integration = Array.isArray(data) ? data[0] : data;
    const now = Date.now();
    const expiresAt = integration?.expires_at ? new Date(integration.expires_at).getTime() : 0;
    const expiresSoon = expiresAt ? now + 10 * 60 * 1000 >= expiresAt : false;

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          connected: Boolean(integration),
          provider: 'x',
          account: integration ? {
            username: integration.x_username,
            user_id: integration.user_id,
            x_user_id: integration.x_user_id,
          } : null,
          token_status: !integration
            ? 'not_connected'
            : !integration.expires_at
              ? 'unknown_expiry'
              : expiresSoon
                ? 'expiring_soon'
                : 'active',
          scopes: integration?.scopes || [],
          next_step: !integration
            ? 'Connect X again from Settings → Integrations.'
            : expiresSoon
              ? 'Reconnect X soon so scheduled posts and OAuth calls keep working.'
              : 'X looks connected and ready.',
        }, null, 2),
      }],
    };
  },
});
