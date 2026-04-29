import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '../../../config/env';
import { createMCPServer } from '../../../services/mcp/MCPServer';

// Define the shape of a JSON-RPC message locally to avoid import issues
type JSONRPCMessage = any;


export const config = {
  api: {
    bodyParser: false,
  },
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, mcp-session-id',
};

class StatelessSupabaseTransport {
  onmessage?: (message: JSONRPCMessage) => void;
  onerror?: (error: Error) => void;
  onclose?: () => void;

  constructor(private sessionId: string, private supabase: any) {}

  async start() {}

  async send(message: JSONRPCMessage) {
    await this.supabase.from('mcp_messages').insert({
      session_id: this.sessionId,
      content: message,
    });
  }

  async close() {
    this.onclose?.();
  }

  async handleIncoming(message: JSONRPCMessage) {
    this.onmessage?.(message);
  }
}

async function readRequestBody(req: NextApiRequest): Promise<string> {
  const chunks: any[] = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  const sessionId = (req.query.sessionId as string) || (req.headers['mcp-session-id'] as string);
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }

  if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'SERVER_CONFIGURATION_ERROR' });
  }

  const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);

  // Validate session and get context
  const { data: session, error: sessionError } = await supabaseAdmin
    .from('mcp_sessions')
    .select('tenant_id, user_id, expires_at')
    .eq('id', sessionId)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (sessionError || !session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  try {
    const rawBody = await readRequestBody(req);
    const message = JSON.parse(rawBody);

    const mcpServer = createMCPServer({
      tenantId: session.tenant_id,
      userId: session.user_id,
      clientLabel: 'claude', // Or detect from headers if needed
    });

    const transport = new StatelessSupabaseTransport(sessionId, supabaseAdmin);
    await mcpServer.server.connect(transport);
    
    // Pass the message to the server via the transport
    await transport.handleIncoming(message);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[MCP Message] Processing failed:', err);
    return res.status(500).json({ error: 'Failed to process MCP request' });
  }
}


