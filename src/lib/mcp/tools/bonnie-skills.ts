// @ts-nocheck
import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { listSkills, loadSkill } from '@/lib/skills/skillService';
import { mcpStore } from '@/services/mcp/mcpStore';

registerTool('bonnie-skills', {
  name: 'list_skills',
  description: 'List available Bonnie agent skills (built-in and tenant custom) with name and description.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const skills = await listSkills(args.tenant_id);
    return {
      content: [{ type: 'text', text: JSON.stringify({ skills }, null, 2) }],
    };
  },
});

registerTool('bonnie-skills', {
  name: 'load_skill',
  description: 'Load full instructions for a Bonnie skill by name (progressive disclosure).',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    name: z.string().min(1),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      name: { type: 'string', description: 'Skill name (e.g. invoice-recovery)' },
    },
    required: ['tenant_id', 'name'],
  },
  handler: async (args) => {
    const skill = await loadSkill(args.tenant_id, args.name);
    if (!skill) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `Skill "${args.name}" not found` }) }],
        isError: true,
      };
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          name: skill.name,
          description: skill.description,
          allowed_tools: skill.allowedTools || [],
          instructions: skill.body,
        }, null, 2),
      }],
    };
  },
});

registerTool('bonnie-skills', {
  name: 'activate_skill_for_session',
  description: 'Activate a skill for the current MCP/Bonnie session (stores in business_ai_state metadata).',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    user_id: z.string().uuid().optional(),
    skill_name: z.string().min(1),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      user_id: { type: 'string', description: 'User UUID' },
      skill_name: { type: 'string', description: 'Skill to activate' },
    },
    required: ['tenant_id', 'skill_name'],
  },
  handler: async (args, ctx) => {
    const skill = await loadSkill(args.tenant_id, args.skill_name);
    if (!skill) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `Skill "${args.skill_name}" not found` }) }],
        isError: true,
      };
    }
    const userId = ctx.userId || args.user_id;
    await mcpStore.updateBusinessAIState(args.tenant_id, userId, {
      memory_summary: `[Active skill: ${skill.name}] ${skill.description}`.slice(0, 480),
    });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          activated: skill.name,
          description: skill.description,
          allowed_tools: skill.allowedTools || [],
        }, null, 2),
      }],
    };
  },
});
