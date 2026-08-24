import { getUnifiedMcpTools } from './src/lib/mcp/listAllTools';
import { initializeRegistry, executeTool } from './src/lib/mcp/tool-registry';

async function testProgressive() {
  initializeRegistry();

  // Test 1: Progressive mode with default loaded modules
  const initialTools = await getUnifiedMcpTools({ catalogMode: 'progressive' });
  console.log(`Progressive initial tools count: ${initialTools.length}`);

  // Test 2: Progressive mode with email & finance loaded
  const loadedTools = await getUnifiedMcpTools({
    catalogMode: 'progressive',
    loadedModules: ['email', 'finance'],
  });
  console.log(`Progressive with email+finance loaded tools count: ${loadedTools.length}`);

  // Verify email & finance tools exist in loadedTools
  const hasSendEmail = loadedTools.some(t => t.name === 'send_email');
  const hasGetBankAccounts = loadedTools.some(t => t.name === 'get_bank_accounts');
  console.log(`Contains send_email: ${hasSendEmail}`);
  console.log(`Contains get_bank_accounts: ${hasGetBankAccounts}`);

  // Test 3: Search tools execution
  const searchResult = await executeTool(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'search_tools',
    { query: 'send email using zoho' }
  );
  console.log('\n--- search_tools execution result ---');
  console.log(JSON.stringify(searchResult, null, 2));

  // Test 4: Dispatch tool execution fallback
  const dispatchResult = await executeTool(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'dispatch_tool',
    { tool_name: 'get_bank_accounts', arguments: {} }
  );
  console.log('\n--- dispatch_tool execution result ---');
  console.log(JSON.stringify(dispatchResult, null, 2));
}

testProgressive().catch(console.error);
