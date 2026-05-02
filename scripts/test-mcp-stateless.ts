import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

async function test() {
  const mcp = new McpServer({ name: 'test', version: '1.0.0' });
  
  mcp.tool('hello', { name: z.string() }, async ({ name }) => {
    return { content: [{ type: 'text', text: `Hello ${name}` }] };
  });

  let responseMessage: any = null;
  const transport = {
    async start() {},
    async close() {},
    async send(message: any) {
      console.log('Server sent:', message);
      responseMessage = message;
    }
  };

  await mcp.server.connect(transport as any);

  // Simulate incoming initialize request
  const initReq = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0" } }
  };

  console.log('Client sending:', initReq);
  if ((transport as any).onmessage) {
    await (transport as any).onmessage(initReq);
  }
  
  console.log('Response captured:', responseMessage);
  
  // Simulate incoming ping
  responseMessage = null;
  const pingReq = {
    jsonrpc: "2.0",
    id: 2,
    method: "ping"
  };
  if ((transport as any).onmessage) {
    await (transport as any).onmessage(pingReq);
  }
  console.log('Response captured:', responseMessage);
}

test().catch(console.error);
