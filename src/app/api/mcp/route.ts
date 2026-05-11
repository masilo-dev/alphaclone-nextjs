import { NextRequest, NextResponse } from 'next/server';
import { getMcpCorsHeaders, handleCorsApp } from '@/services/mcp/authMiddlewareApp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 800;

/**
 * Unified MCP Endpoint (/api/mcp)
 * 
 * This route serves as a single entry point for both:
 * 1. GET requests (Discovery): Returns the full tool manifest for AI clients.
 * 2. POST requests (JSON-RPC): Proxies calls to the MCP execution engine.
 */

export async function POST(req: NextRequest) {
  const cors = handleCorsApp(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const apiKey = url.searchParams.get('api_key') || '';
  
  try {
    const body = await req.json();

    // Forward everything to the messages handler
    const upstreamUrl = `${url.origin}/api/mcp/messages${url.search}`;
    
    // Explicitly propagate critical headers
    const forwardHeaders = new Headers();
    const headersToForward = [
      'authorization', 
      'x-api-key', 
      'mcp-session-id', 
      'mcp-protocol-version', 
      'x-mcp-version', 
      'x-client-label', 
      'content-type'
    ];
    
    headersToForward.forEach(h => {
      const val = req.headers.get(h);
      if (val) forwardHeaders.set(h, val);
    });

    // Ensure api_key from URL is also passed if not already in headers
    if (apiKey && !forwardHeaders.has('x-api-key')) {
      forwardHeaders.set('x-api-key', apiKey);
    }

    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: forwardHeaders,
      body: JSON.stringify(body),
    });

    // Safe response handling
    const responseText = await upstream.text();
    
    if (!responseText || responseText.trim() === '') {
      console.error('[MCP Single Endpoint] Empty response from upstream');
      return NextResponse.json(
        { jsonrpc: '2.0', id: body.id, error: { code: -32603, message: 'Empty upstream response' } },
        { status: 502, headers: getMcpCorsHeaders(req) }
      );
    }

    try {
      const data = JSON.parse(responseText);
      const responseHeaders = new Headers(getMcpCorsHeaders(req));
      
      // Propagate session ID if present
      const sessionId = upstream.headers.get('Mcp-Session-Id');
      if (sessionId) {
        responseHeaders.set('Mcp-Session-Id', sessionId);
      }

      return NextResponse.json(data, { 
        status: upstream.status,
        headers: responseHeaders 
      });
    } catch (err) {
      console.error('[MCP Single Endpoint] Failed to parse upstream response:', responseText);
      return NextResponse.json(
        { jsonrpc: '2.0', id: body.id, error: { code: -32603, message: 'Invalid upstream response' } },
        { status: 502, headers: getMcpCorsHeaders(req) }
      );
    }
  } catch (err) {
    console.error('[MCP Single Endpoint] POST Upstream error:', err);
    return NextResponse.json(
      { error: 'Upstream processing failed' }, 
      { status: 502, headers: getMcpCorsHeaders(req) }
    );
  }
}

export async function GET(req: NextRequest) {
  const cors = handleCorsApp(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const apiKey = url.searchParams.get('api_key') || '';

  // Forward to discovery handler which returns the full tool list by default
  const upstreamUrl = `${url.origin}/api/mcp/tools${url.search}`;

  try {
    const forwardHeaders = new Headers();
    const headersToForward = ['authorization', 'x-api-key', 'mcp-session-id', 'x-client-label'];
    headersToForward.forEach(h => {
      const val = req.headers.get(h);
      if (val) forwardHeaders.set(h, val);
    });

    if (apiKey && !forwardHeaders.has('x-api-key')) {
      forwardHeaders.set('x-api-key', apiKey);
    }

    const upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers: forwardHeaders,
    });

    const data = await upstream.json();
    return NextResponse.json(data, { 
      status: upstream.status,
      headers: getMcpCorsHeaders(req) 
    });
  } catch (err) {
    console.error('[MCP Single Endpoint] GET Upstream error:', err);
    return NextResponse.json(
      { error: 'Discovery fetch failed' }, 
      { status: 502, headers: getMcpCorsHeaders(req) }
    );
  }
}

export async function OPTIONS(req: NextRequest) {
  return handleCorsApp(req) || 
    new NextResponse(null, { status: 204, headers: getMcpCorsHeaders(req) });
}
