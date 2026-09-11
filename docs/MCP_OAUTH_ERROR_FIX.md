# MCP OAuth Error Fix - "ofid_39198e394feb99f2"

## Error Message

```
Couldn't register with Alphaclone's sign-in service.
You can try again, or add an OAuth Client ID in the connector settings.
If this persists, share this reference with support: "ofid_39198e394feb99f2"
```

## What This Error Means

This error occurs when **Claude.ai** (Anthropic's AI assistant) tries to connect to AlphaClone via the **Model Context Protocol (MCP)** but cannot complete the OAuth authentication flow.

### Root Cause

The `ofid_39198e394feb99f2` error reference indicates that Claude.ai's MCP connector cannot find or authenticate with AlphaClone's OAuth server. This typically happens because:

1. **Missing OAuth Client Registration**: Claude.ai's OAuth client ID isn't registered in AlphaClone's database
2. **Mismatched Redirect URIs**: The redirect URLs don't match between Claude.ai and AlphaClone
3. **Database Migration Issue**: The `mcp_oauth_clients` table might not have the correct entries

## Quick Fix

### Option 1: Run the Fix Script (Recommended)

```bash
# Navigate to your project directory
cd /home/bonnie/alphaclone-nextjs-1

# Run the fix script
node scripts/fix-claude-oauth.js
```

### Option 2: Apply Database Migration

```bash
# Using Supabase CLI
supabase db push

# Or run the migration directly
psql $DATABASE_URL -f supabase/migrations/20260624190000_fix_claude_mcp_oauth_client.sql
```

### Option 3: Manual SQL (via Supabase Dashboard)

Go to your Supabase Dashboard → SQL Editor and run:

```sql
-- Register Claude Desktop client
INSERT INTO mcp_oauth_clients (client_id, client_name, redirect_uris, is_public, scopes, is_active)
VALUES (
  '1778309945386-41bab8272f61',
  'Claude Desktop (Anthropic)',
  ARRAY[
    'https://claude.ai/api/mcp/auth_callback',
    'https://claude.ai/settings/oauth-callback',
    'https://api.claude.ai/v1/oauth/callback'
  ],
  TRUE,
  ARRAY['read', 'write', 'mcp:tools', 'mcp:resources', 'openid', 'profile'],
  TRUE
)
ON CONFLICT (client_id) DO UPDATE SET
  redirect_uris = EXCLUDED.redirect_uris,
  scopes = EXCLUDED.scopes,
  is_active = TRUE;
```

## Technical Details

### MCP OAuth Flow

```
┌─────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  Claude.ai  │ ──────► │  AlphaClone MCP │ ──────► │  AlphaClone DB  │
│   Client    │  OAuth  │   OAuth Server  │  Store  │ mcp_oauth_clients│
└─────────────┘         └─────────────────┘         └─────────────────┘
```

### Required OAuth Clients

The following clients must be registered in `mcp_oauth_clients`:

| Client ID                    | Name           | Type          | Status                |
| ---------------------------- | -------------- | ------------- | --------------------- |
| `1778309945386-41bab8272f61` | Claude Desktop | Public (PKCE) | ✅ Required           |
| `CLAUDE`                     | Claude Legacy  | Public (PKCE) | ✅ Recommended        |
| `claude-web`                 | Claude Web     | Public (PKCE) | ✅ Recommended        |
| `chatgpt-connector`          | ChatGPT        | Public (PKCE) | ✅ Already registered |
| `grok-connector`             | Grok           | Public (PKCE) | ✅ Already registered |

### Database Schema

**Table: `mcp_oauth_clients`**

- `client_id` (TEXT, UNIQUE): OAuth client identifier
- `client_name` (TEXT): Human-readable name
- `redirect_uris` (TEXT[]): Allowed redirect URLs
- `is_public` (BOOLEAN): TRUE for PKCE-based clients (no secret)
- `scopes` (TEXT[]): Allowed OAuth scopes
- `is_active` (BOOLEAN): Whether client is enabled

## Verification

After applying the fix, verify the registration:

```sql
-- Check all registered clients
SELECT client_id, client_name, is_active, array_length(redirect_uris, 1) as uri_count
FROM mcp_oauth_clients
WHERE client_name ILIKE '%claude%';

-- Expected output:
-- client_id                     | client_name               | is_active | uri_count
-- ------------------------------+---------------------------+-----------+----------
-- 1778309945386-41bab8272f61    | Claude Desktop (Anthropic)| t         | 3
-- CLAUDE                        | Claude AI (Legacy)        | t         | 3
-- claude-web                    | Claude Web (Anthropic)    | t         | 3
```

## Testing the Connection

1. Go to [Claude.ai](https://claude.ai)
2. Navigate to Settings → Connectors → MCP
3. Click "Add Connector"
4. Enter your AlphaClone MCP Server URL (e.g., `https://alphaclonesystems.com/api/mcp`)
5. Select OAuth authentication
6. You should be redirected to AlphaClone's sign-in page
7. After signing in, Claude should successfully connect

## Troubleshooting

### If the error persists after fix:

1. **Check Redirect URIs**: Ensure the redirect URI in the request matches exactly

   ```sql
   SELECT client_id, redirect_uris
   FROM mcp_oauth_clients
   WHERE client_id = '1778309945386-41bab8272f61';
   ```

2. **Verify Table Exists**:

   ```sql
   SELECT EXISTS (
     SELECT FROM information_schema.tables
     WHERE table_name = 'mcp_oauth_clients'
   );
   ```

3. **Check RLS Policies**: Ensure Row Level Security isn't blocking reads:

   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'mcp_oauth_clients';
   ```

4. **Review Server Logs**: Check Vercel/Supabase logs for:
   - `[MCP Token] Client authentication failed`
   - `[MCP Register] Database error`
   - `[OAuth Approve] Failed to store auth code`

### Related Error Codes

| Error Reference         | Likely Cause                               |
| ----------------------- | ------------------------------------------ |
| `ofid_39198e394feb99f2` | Missing OAuth client registration          |
| `ofid_*` (various)      | Claude.ai MCP initialization failure       |
| "invalid_client"        | Client ID not found in database            |
| "redirect_uri mismatch" | Redirect URL doesn't match registered URIs |

## Support

If the issue persists after applying this fix:

1. Share the error reference: **`ofid_39198e394feb99f2`**
2. Include the output of the fix script
3. Provide server logs from `/api/mcp/*` endpoints
4. Check [update.md](../update.md) for related MCP fixes

## References

- [MCP OAuth Tables Migration](../supabase/migrations/20260509130000_create_mcp_oauth_tables.sql)
- [Claude OAuth Fix Migration](../supabase/migrations/20260624190000_fix_claude_mcp_oauth_client.sql)
- [MCP Token Route](../src/app/api/mcp/token/route.ts)
- [MCP OAuth Approve](../src/app/api/mcp/oauth/approve/route.ts)
