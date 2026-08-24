import { createMCPServer } from './src/services/mcp/MCPServer';
import { listTools, initializeRegistry } from './src/lib/mcp/tool-registry';

async function checkMCPServer() {
  initializeRegistry();
  const serverInstance = createMCPServer({ tenantId: 'test_tenant', userId: 'test_user' });
  
  // Let's inspect tools in MCPServer
  console.log("MCPServer instantiated.");
}

checkMCPServer().catch(console.error);
