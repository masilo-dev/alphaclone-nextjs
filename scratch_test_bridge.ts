import { initializeRegistry, listTools, hasTool, registerTool } from './src/lib/mcp/tool-registry';
import { MCP_TOOLS } from './src/services/mcp/toolManifest';
import { SUPPLEMENTAL_MCP_TOOLS } from './src/lib/mcp/supplementalToolDefinitions';
import { getUnifiedMcpTools } from './src/lib/mcp/listAllTools';
import { z } from 'zod';

function jsonSchemaToZod(jsonSchema: any): z.ZodObject<any> {
  const properties = jsonSchema?.properties || {};
  const required = new Set(jsonSchema?.required || []);
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, prop] of Object.entries<any>(properties)) {
    let schema: z.ZodTypeAny;

    switch (prop.type) {
      case 'string':
        schema = z.string();
        break;
      case 'number':
      case 'integer':
        schema = z.number();
        break;
      case 'boolean':
        schema = z.boolean();
        break;
      case 'array':
        schema = z.array(z.any());
        break;
      case 'object':
        schema = z.record(z.any());
        break;
      default:
        schema = z.any();
    }

    if (prop.description) {
      schema = schema.describe(prop.description);
    }

    if (!required.has(key)) {
      schema = schema.optional();
    }

    shape[key] = schema;
  }

  return z.object(shape).passthrough();
}

async function testBridge() {
  initializeRegistry();
  console.log(`Initial registered count: ${listTools(false).length}`);

  const allManifestAndSupp = [...MCP_TOOLS, ...SUPPLEMENTAL_MCP_TOOLS];
  let newRegisteredCount = 0;

  for (const toolDef of allManifestAndSupp) {
    if (!hasTool(toolDef.name)) {
      const zodSchema = jsonSchemaToZod(toolDef.inputSchema);
      registerTool('manifest', {
        name: toolDef.name,
        description: toolDef.description || '',
        jsonSchema: toolDef.inputSchema as Record<string, unknown>,
        inputSchema: zodSchema,
        handler: async (args: any, ctx: { tenantId: string; userId: string }) => {
          return { success: true, tool: toolDef.name, message: 'Bridge handler' };
        },
      });
      newRegisteredCount++;
    }
  }

  console.log(`Newly registered via bridge: ${newRegisteredCount}`);
  console.log(`Total registered now: ${listTools(false).length}`);

  const unified = await getUnifiedMcpTools({ catalogMode: 'full' });
  console.log(`Unified tools count: ${unified.length}`);
}

testBridge().catch(console.error);
