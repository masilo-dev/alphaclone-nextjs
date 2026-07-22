import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';
import {
  buildAuthorizePageUrl,
  isRedirectUriAllowed,
  normalizeMcpClientId,
  PLATFORM_MCP_OAUTH_CLIENT_IDS,
  CHATGPT_OAUTH_REDIRECT_URIS,
  shouldUseBrowserOAuthConsent,
} from '@/lib/mcp/oauthRedirect';
import { lookupMcpApiKey } from '@/lib/security/mcpApiKeyLookup';
import { getMcpPublicBaseUrl } from '@/lib/mcpWellKnown';
import { PUBLIC_MCP_RESOURCE } from '@/lib/config/public-origin';

/**
 * MCP OAuth2 Authorization Endpoint — Dual-Mode
 *
 * Mode 1 — Automated (headless CLI/API clients):
 *   GET with Authorization: Bearer <mcp_api_key>
 *   → validates key, issues code, redirects immediately
 *
 * Mode 2 — Browser (Claude, Manus, etc.):
 *   GET without Authorization header (standard OAuth browser redirect)
 *   → serves an HTML consent page with an API key entry form
 *   POST with api_key field in form body
 *   → validates key, issues code, redirects to client callback
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 800;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
};

function oauthError(redirectUri: string | null, error: string, description: string, state?: string | null) {
  if (redirectUri) {
    try {
      const url = new URL(redirectUri);
      url.searchParams.set('error', error);
      url.searchParams.set('error_description', description);
      if (state) url.searchParams.set('state', state);
      return Response.redirect(url.toString(), 302);
    } catch { /* fall through */ }
  }
  return new Response(JSON.stringify({ error, error_description: description }), {
    status: 400,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function serveConsentPage(params: {
  responseType: string;
  clientId: string;
  redirectUri: string;
  state: string | null;
  codeChallenge: string | null;
  codeChallengeMethod: string;
  scope: string;
  error?: string;
}) {
  const hidden = (name: string, value: string | null) =>
    value ? `<input type="hidden" name="${name}" value="${value?.replace(/"/g, '&quot;')}">` : '';

  const errorBlock = params.error
    ? `<div class="error">${params.error}</div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connect to AlphaClone</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
      color: #f1f5f9;
    }
    .card {
      background: rgba(30, 41, 59, 0.9);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px;
      padding: 2.5rem;
      width: 100%;
      max-width: 420px;
      backdrop-filter: blur(20px);
      box-shadow: 0 25px 50px rgba(0,0,0,0.4);
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.75rem;
    }
    .logo-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #14b8a6, #6366f1);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 1.1rem;
      color: white;
    }
    .logo-text { font-size: 1.1rem; font-weight: 700; color: #f1f5f9; }
    h1 { font-size: 1.35rem; font-weight: 700; color: #f1f5f9; margin-bottom: 0.5rem; }
    .subtitle { color: #94a3b8; font-size: 0.875rem; margin-bottom: 1.5rem; line-height: 1.5; }
    label {
      display: block;
      font-size: 0.8rem;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }
    input[type="text"], input[type="password"] {
      width: 100%;
      padding: 0.75rem 1rem;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      color: #f1f5f9;
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.2s;
      font-family: monospace;
    }
    input[type="text"]:focus, input[type="password"]:focus {
      border-color: #14b8a6;
    }
    .field { margin-bottom: 1.25rem; }
    .help {
      font-size: 0.78rem;
      color: #64748b;
      margin-top: 0.5rem;
      line-height: 1.5;
    }
    .help a { color: #14b8a6; text-decoration: none; }
    button[type="submit"] {
      width: 100%;
      padding: 0.85rem;
      background: linear-gradient(135deg, #14b8a6, #6366f1);
      border: none;
      border-radius: 10px;
      color: white;
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.1s;
      margin-top: 0.5rem;
    }
    button[type="submit"]:hover { opacity: 0.9; transform: translateY(-1px); }
    button[type="submit"]:active { transform: translateY(0); }
    .error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      color: #f87171;
      font-size: 0.875rem;
      margin-bottom: 1.25rem;
    }
    .scope-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      background: rgba(20, 184, 166, 0.1);
      border: 1px solid rgba(20, 184, 166, 0.25);
      border-radius: 999px;
      padding: 0.2rem 0.65rem;
      font-size: 0.75rem;
      color: #5eead4;
      font-weight: 600;
      margin-bottom: 1.5rem;
    }
  </style>
</head>
  <body>
  <div class="card">
    <div class="logo">
      <div class="logo-icon">A</div>
      <span class="logo-text">AlphaClone Systems</span>
    </div>
    <h1>Connect AI Agent</h1>
    <p class="subtitle">An AI agent is requesting access to your AlphaClone workspace. Enter your MCP API key to authorize.</p>
    <div class="scope-badge">
      <span>●</span> Requested scope: ${params.scope}
    </div>
    <div id="error-block">${errorBlock}</div>
    <form id="auth-form" autocomplete="off">
      <div class="field">
        <label for="api_key">MCP API Key</label>
        <input
          type="password"
          id="api_key"
          name="api_key"
          placeholder="ac_mcp_..."
          required
          autofocus
        >
        <p class="help">
          Find your key in <a href="/dashboard/marketplace" target="_blank">Dashboard → Marketplace → MCP</a>.
        </p>
      </div>
      <button type="submit" id="submit-btn">Authorize Access</button>
    </form>
  </div>
  <script>
    // Use fetch() instead of form POST to bypass form-action CSP.
    // fetch() is governed by connect-src 'self' which is already allowed.
    document.getElementById('auth-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      var btn = document.getElementById('submit-btn');
      btn.disabled = true;
      btn.textContent = 'Authorizing...';
      var errEl = document.getElementById('error-block');
      errEl.innerHTML = '';

      var body = new URLSearchParams({
        response_type: ${JSON.stringify(params.responseType)},
        client_id: ${JSON.stringify(params.clientId)},
        redirect_uri: ${JSON.stringify(params.redirectUri)},
        state: ${JSON.stringify(params.state ?? '')},
        code_challenge: ${JSON.stringify(params.codeChallenge ?? '')},
        code_challenge_method: ${JSON.stringify(params.codeChallengeMethod)},
        scope: ${JSON.stringify(params.scope)},
        api_key: document.getElementById('api_key').value.trim()
      });

      try {
        var res = await fetch('/api/mcp/authorize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: body.toString()
        });
        var data = await res.json();
        if (data.redirect) {
          window.location.href = data.redirect;
        } else if (data.error) {
          errEl.innerHTML = '<div class="error">' + data.error_description + '</div>';
          btn.disabled = false;
          btn.textContent = 'Authorize Access';
        } else {
          errEl.innerHTML = '<div class="error">Unexpected response. Please try again.</div>';
          btn.disabled = false;
          btn.textContent = 'Authorize Access';
        }
      } catch (err) {
        errEl.innerHTML = '<div class="error">Network error. Please check your connection and try again.</div>';
        btn.disabled = false;
        btn.textContent = 'Authorize Access';
      }
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...CORS_HEADERS },
  });
}

async function handleAuthorize(req: NextRequest, apiKey: string | null) {
  const { searchParams } = new URL(req.url);
  const responseType        = searchParams.get('response_type') ?? 'code';
  const rawClientId         = searchParams.get('client_id') ?? '';
  const clientId            = normalizeMcpClientId(rawClientId) ?? rawClientId;
  const redirectUri         = searchParams.get('redirect_uri') ?? '';
  const state               = searchParams.get('state');
  const codeChallenge       = searchParams.get('code_challenge');
  const codeChallengeMethod = searchParams.get('code_challenge_method') ?? 'S256';
  const scope               = searchParams.get('scope') ?? 'read write';

  if (responseType !== 'code') {
    return oauthError(redirectUri, 'unsupported_response_type', 'Only response_type=code is supported', state);
  }
  if (!clientId || !redirectUri) {
    return oauthError(redirectUri, 'invalid_request', 'client_id and redirect_uri are required', state);
  }

  if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
    return oauthError(redirectUri, 'server_error', 'Server configuration error', state);
  }

  const supabase = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);

  const { data: client } = await supabase
    .from('mcp_oauth_clients')
    .select('client_id, redirect_uris, is_public')
    .eq('client_id', clientId)
    .maybeSingle();

  if (client) {
    const allowedRedirects: string[] = [
      ...(client.redirect_uris || []),
      // Always allow known ChatGPT Apps redirect patterns for the platform client.
      ...(clientId === 'chatgpt-connector' || clientId === 'alphaclone-mcp-client'
        ? CHATGPT_OAUTH_REDIRECT_URIS
        : []),
    ];
    if (!isRedirectUriAllowed(redirectUri, allowedRedirects)) {
      console.warn('[MCP Authorize] redirect_uri mismatch. Got:', redirectUri, 'Allowed:', allowedRedirects);
      return oauthError(null, 'invalid_request', 'redirect_uri is not registered for this client', state);
    }
  } else if (PLATFORM_MCP_OAUTH_CLIENT_IDS.has(clientId)) {
    console.error('[MCP Authorize] Platform client not registered in database:', clientId);
    return oauthError(
      redirectUri,
      'invalid_client',
      'This AI connector is not configured on this server. Contact support or run MCP client migration.',
      state
    );
  }

  // ChatGPT / Claude / other PKCE connectors → login + consent UI (not API-key form)
  if (
    !apiKey &&
    shouldUseBrowserOAuthConsent({
      clientId,
      codeChallenge,
      isPublicClient: client?.is_public,
    })
  ) {
    const origin = getMcpPublicBaseUrl(req);
    const authorizeUrl = buildAuthorizePageUrl(origin, new URL(req.url).searchParams);
    return Response.redirect(authorizeUrl, 302);
  }

  // No API key → serve the HTML consent form (legacy MCP API-key flow)
  if (!apiKey) {
    return serveConsentPage({ responseType, clientId, redirectUri, state, codeChallenge, codeChallengeMethod, scope });
  }

  // Validate API key → resolve tenant + user
  const keyData = await lookupMcpApiKey(supabase, apiKey, { requireActive: true });

  if (!keyData) {
    console.warn('[MCP Authorize] Invalid API key presented');
    // If browser form, re-render with error instead of redirecting with access_denied
    return serveConsentPage({
      responseType, clientId, redirectUri, state, codeChallenge, codeChallengeMethod, scope,
      error: 'Invalid or expired API key. Please check your key and try again.',
    });
  }

  // Generate single-use auth code
  const code = `ac_${crypto.randomUUID().replace(/-/g, '')}`;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

  const codeRow: Record<string, unknown> = {
      code,
      client_id: clientId,
      user_id: keyData.user_id,
      tenant_id: keyData.tenant_id,
      redirect_uri: redirectUri,
      scopes: scope.split(' ').filter(Boolean),
      expires_at: expiresAt,
      code_challenge: codeChallenge || null,
      code_challenge_method: codeChallenge ? codeChallengeMethod : null,
      used: false,
      resource: PUBLIC_MCP_RESOURCE,
    };

  let { error: insertError } = await supabase.from('mcp_oauth_codes').insert(codeRow);
  if (insertError?.code === '42703' || insertError?.message?.includes('resource')) {
    const { resource: _r, ...legacy } = codeRow;
    ({ error: insertError } = await supabase.from('mcp_oauth_codes').insert(legacy));
  }

  if (insertError) {
    console.error('[MCP Authorize] Failed to store auth code:', insertError);
    return oauthError(redirectUri, 'server_error', 'Failed to generate authorization code', state);
  }

  console.log('[MCP Authorize] Auth code issued for client:', clientId, '→ user:', keyData.user_id);

  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set('code', code);
  if (state) callbackUrl.searchParams.set('state', state);

  // If caller accepts JSON (JS fetch from consent page), return redirect URL in JSON body.
  // This bypasses form-action CSP — fetch() is governed by connect-src 'self' instead.
  const acceptHeader = req.headers.get('accept') ?? '';
  if (acceptHeader.includes('application/json')) {
    return new Response(JSON.stringify({ redirect: callbackUrl.toString() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  return Response.redirect(callbackUrl.toString(), 302);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const apiKeyHeader = req.headers.get('x-api-key') || '';
  const apiKey = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : apiKeyHeader.trim() || null;

  return handleAuthorize(req, apiKey);
}

export async function POST(req: NextRequest) {
  // Handle the HTML form submission from the consent page
  let apiKey: string | null = null;
  let bodyParams: URLSearchParams | null = null;

  try {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text();
      bodyParams = new URLSearchParams(text);
      apiKey = bodyParams.get('api_key')?.trim() || null;
    } else {
      // JSON body (programmatic POST)
      const json = await req.json().catch(() => ({}));
      apiKey = json.api_key?.trim() || null;
    }
  } catch { /* ignore body parse errors */ }

  // Merge POST body params into URL search params for handleAuthorize
  // Build a synthetic request with merged params
  const url = new URL(req.url);
  if (bodyParams) {
    for (const [k, v] of bodyParams.entries()) {
      if (k !== 'api_key' && !url.searchParams.has(k)) {
        url.searchParams.set(k, v);
      }
    }
  }
  const syntheticReq = new NextRequest(url.toString(), { headers: req.headers });
  return handleAuthorize(syntheticReq, apiKey);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
