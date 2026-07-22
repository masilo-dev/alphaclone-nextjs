/**
 * Regression: chatgpt-connector client loader must tolerate missing is_active
 * and auto-seed platform clients.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.PUBLIC_APP_ORIGIN = process.env.PUBLIC_APP_ORIGIN || 'https://alphaclonesystems.com';
process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com';
process.env.PUBLIC_MCP_RESOURCE =
  process.env.PUBLIC_MCP_RESOURCE || 'https://alphaclonesystems.com/api/mcp';

const { loadMcpOAuthClient, ensurePlatformMcpOAuthClient } = await import(
  '../../src/lib/mcp/ensureOAuthClient.ts'
);

function mockSupabase(opts: {
  firstError?: { code?: string; message?: string } | null;
  firstData?: any;
  afterSeedData?: any;
}) {
  let upserted = false;
  return {
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle: async () => {
          if (!upserted && opts.firstError) {
            return { data: null, error: opts.firstError };
          }
          if (!upserted && opts.firstData) {
            return { data: opts.firstData, error: null };
          }
          if (upserted) {
            return {
              data: opts.afterSeedData || {
                client_id: 'chatgpt-connector',
                is_public: true,
                client_secret: 'public',
              },
              error: null,
            };
          }
          return { data: null, error: null };
        },
        upsert: async () => {
          upserted = true;
          return { error: null };
        },
      };
    },
  };
}

describe('ensureOAuthClient', () => {
  it('retries without is_active when column is missing', async () => {
    let call = 0;
    const supabase = {
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => {
            call += 1;
            if (call === 1) {
              return {
                data: null,
                error: { code: '42703', message: 'column mcp_oauth_clients.is_active does not exist' },
              };
            }
            return {
              data: { client_id: 'chatgpt-connector', is_public: true, client_secret: 'public' },
              error: null,
            };
          },
          upsert: async () => ({ error: null }),
        };
      },
    };

    const loaded = await loadMcpOAuthClient(supabase, 'chatgpt-connector');
    assert.equal(loaded.client?.client_id, 'chatgpt-connector');
  });

  it('auto-seeds chatgpt-connector when missing', async () => {
    const supabase = mockSupabase({
      firstData: null,
      afterSeedData: {
        client_id: 'chatgpt-connector',
        is_public: true,
        client_secret: 'public',
      },
    });
    // First lookup returns null (not found), then seed, then retry
    let phase = 0;
    const sb = {
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => {
            phase += 1;
            if (phase === 1) return { data: null, error: null };
            return {
              data: { client_id: 'chatgpt-connector', is_public: true, client_secret: 'public' },
              error: null,
            };
          },
          upsert: async () => ({ error: null }),
        };
      },
    };
    const loaded = await loadMcpOAuthClient(sb, 'chatgpt-connector');
    assert.equal(loaded.client?.client_id, 'chatgpt-connector');
    assert.equal(await ensurePlatformMcpOAuthClient(sb, 'chatgpt-connector'), true);
  });
});
