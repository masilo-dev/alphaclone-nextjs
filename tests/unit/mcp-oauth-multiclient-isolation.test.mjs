/**
 * Multi-client OAuth isolation:
 * Authorizing Client B must not revoke/overwrite Client A's tokens.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.PUBLIC_APP_ORIGIN =
  process.env.PUBLIC_APP_ORIGIN || "https://alphaclonesystems.com";
process.env.NEXT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://alphaclonesystems.com";
process.env.PUBLIC_MCP_RESOURCE =
  process.env.PUBLIC_MCP_RESOURCE || "https://alphaclonesystems.com/api/mcp";

const {
  assertRefreshClientBinding,
  revokeActiveTokensForClient,
  tokensAreIsolatedAcrossClients,
} = await import("../../src/lib/mcp/oauthTokenIsolation.ts");

/**
 * In-memory stand-in for mcp_oauth_tokens used to prove authorize A → authorize B
 * leaves Client A still valid.
 */
function createTokenStore() {
  /** @type {Array<Record<string, any>>} */
  const rows = [];

  function insert(row) {
    rows.push({
      id: row.id || `tok_${rows.length + 1}`,
      revoked: false,
      ...row,
    });
    return rows[rows.length - 1];
  }

  function findActive(accessToken) {
    return (
      rows.find((r) => r.access_token === accessToken && r.revoked !== true) ||
      null
    );
  }

  /** Mimics the Supabase chain used by revokeActiveTokensForClient */
  const supabase = {
    from(table) {
      assert.equal(table, "mcp_oauth_tokens");
      return {
        update(values) {
          /** @type {Record<string, unknown>} */
          const filters = {};
          const apply = async () => {
            for (const row of rows) {
              let match = true;
              for (const [k, v] of Object.entries(filters)) {
                if (row[k] !== v) {
                  match = false;
                  break;
                }
              }
              if (match) Object.assign(row, values);
            }
            return { error: null };
          };
          const chain = {
            eq(column, value) {
              filters[column] = value;
              return chain;
            },
            then(onFulfilled, onRejected) {
              return apply().then(onFulfilled, onRejected);
            },
          };
          return chain;
        },
      };
    },
  };

  return { rows, insert, findActive, supabase };
}

/**
 * Simulate authorization_code issuance with per-client revoke-before-insert
 * (same policy as /api/mcp/token).
 */
async function authorizeClient(store, params) {
  const { userId, clientId, accessToken, refreshToken } = params;
  await revokeActiveTokensForClient(store.supabase, { userId, clientId });
  return store.insert({
    user_id: userId,
    client_id: clientId,
    access_token: accessToken,
    refresh_token: refreshToken,
    tenant_id: "tenant-1",
    revoked: false,
  });
}

describe("MCP OAuth multi-client token isolation", () => {
  it("keeps Client A token valid after Client B authorizes for the same user", async () => {
    const store = createTokenStore();
    const userId = "user-shared-1";

    const clientA = await authorizeClient(store, {
      userId,
      clientId: "1778309945386-41bab8272f61", // Claude
      accessToken: "mcp_at_client_a",
      refreshToken: "mcp_rt_client_a",
    });

    assert.equal(
      store.findActive("mcp_at_client_a")?.client_id,
      "1778309945386-41bab8272f61",
    );
    assert.equal(clientA.revoked, false);

    await authorizeClient(store, {
      userId,
      clientId: "chatgpt-connector",
      accessToken: "mcp_at_client_b",
      refreshToken: "mcp_rt_client_b",
    });

    const stillA = store.findActive("mcp_at_client_a");
    const stillB = store.findActive("mcp_at_client_b");

    assert.ok(
      stillA,
      "Client A access token must remain active after Client B authorizes",
    );
    assert.ok(stillB, "Client B access token must be active");
    assert.equal(stillA.revoked, false);
    assert.equal(stillB.revoked, false);
    assert.ok(
      tokensAreIsolatedAcrossClients(stillA, stillB),
      "tokens must be independent rows with distinct client_ids",
    );
  });

  it("re-authorizing the same client revokes only that client prior tokens", async () => {
    const store = createTokenStore();
    const userId = "user-shared-2";

    await authorizeClient(store, {
      userId,
      clientId: "chatgpt-connector",
      accessToken: "mcp_at_chatgpt_v1",
      refreshToken: "mcp_rt_chatgpt_v1",
    });
    await authorizeClient(store, {
      userId,
      clientId: "1778309945386-41bab8272f61",
      accessToken: "mcp_at_claude_v1",
      refreshToken: "mcp_rt_claude_v1",
    });

    // ChatGPT reconnects — Claude must survive
    await authorizeClient(store, {
      userId,
      clientId: "chatgpt-connector",
      accessToken: "mcp_at_chatgpt_v2",
      refreshToken: "mcp_rt_chatgpt_v2",
    });

    assert.equal(store.findActive("mcp_at_chatgpt_v1"), null);
    assert.ok(store.findActive("mcp_at_chatgpt_v2"));
    assert.ok(
      store.findActive("mcp_at_claude_v1"),
      "Claude token must remain valid when ChatGPT rotates",
    );
  });

  it("refresh client binding rejects mismatched client_id", () => {
    const ok = assertRefreshClientBinding({
      requestClientId: "chatgpt-connector",
      tokenClientId: "chatgpt-connector",
    });
    assert.equal(ok.ok, true);

    const bad = assertRefreshClientBinding({
      requestClientId: "chatgpt-connector",
      tokenClientId: "1778309945386-41bab8272f61",
    });
    assert.equal(bad.ok, false);
  });

  it("refresh client binding allows legacy missing client_id", () => {
    assert.equal(
      assertRefreshClientBinding({
        requestClientId: null,
        tokenClientId: "chatgpt-connector",
      }).ok,
      true,
    );
    assert.equal(
      assertRefreshClientBinding({
        requestClientId: "chatgpt-connector",
        tokenClientId: null,
      }).ok,
      true,
    );
  });
});
