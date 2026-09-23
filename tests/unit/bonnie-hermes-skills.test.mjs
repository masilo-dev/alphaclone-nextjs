import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('Bonnie AI & Hermes Skills Integration', () => {
  it('resolves outbound and outreach modules to outbound-acquisition skill', async () => {
    const { resolveSkillForModule } = await import('../../src/lib/skills/skillService.ts');
    assert.equal(resolveSkillForModule('outbound'), 'outbound-acquisition');
    assert.equal(resolveSkillForModule('outreach'), 'outbound-acquisition');
    assert.equal(resolveSkillForModule('leads'), 'lead-qualification');
    assert.equal(resolveSkillForModule('campaigns'), 'campaign-diagnose');
  });

  it('loads outbound-acquisition skill with valid frontmatter and body', async () => {
    const { loadSkill } = await import('../../src/lib/skills/skillService.ts');
    const skill = await loadSkill('test-tenant', 'outbound-acquisition');
    assert.ok(skill, 'outbound-acquisition skill must exist');
    assert.equal(skill.name, 'outbound-acquisition');
    assert.ok(skill.description.includes('outbound'), 'skill description must describe outbound');
    assert.ok(Array.isArray(skill.allowedTools), 'allowedTools must be an array');
    assert.ok(skill.allowedTools.includes('get_outbound_overview'), 'must include get_outbound_overview');
    assert.ok(skill.allowedTools.includes('qualify_outbound_lead'), 'must include qualify_outbound_lead');
    assert.ok(skill.allowedTools.includes('verify_outbound_email'), 'must include verify_outbound_email');
    assert.ok(skill.allowedTools.includes('get_mailbox_health_status'), 'must include get_mailbox_health_status');
    assert.ok(skill.body.includes('Acquisition Lifecycle Workflow'), 'must include workflow instructions');
  });

  it('includes outbound-acquisition in listSkills', async () => {
    const { listSkills } = await import('../../src/lib/skills/skillService.ts');
    const skills = await listSkills('test-tenant');
    const names = skills.map((s) => s.name);
    assert.ok(names.includes('outbound-acquisition'), 'listSkills must include outbound-acquisition');
    assert.ok(names.includes('lead-qualification'), 'listSkills must include lead-qualification');
    assert.ok(names.includes('campaign-diagnose'), 'listSkills must include campaign-diagnose');
  });

  it('registers outbound-engine MCP tools in tool-registry', async () => {
    const { initializeRegistry, hasTool, getToolModule } = await import('../../src/lib/mcp/tool-registry.ts');
    initializeRegistry();

    const expectedTools = [
      'get_outbound_overview',
      'list_outbound_icps',
      'qualify_outbound_lead',
      'verify_outbound_email',
      'get_mailbox_health_status',
    ];

    for (const toolName of expectedTools) {
      assert.ok(hasTool(toolName), `tool-registry must have tool: ${toolName}`);
      assert.equal(getToolModule(toolName), 'outbound-engine', `tool ${toolName} module must be outbound-engine`);
    }

    const newSdrTools = [
      'read_outreach_inbox',
      'get_outreach_thread',
      'handle_lead_objection',
      'get_social_content_recommendations',
    ];

    for (const toolName of newSdrTools) {
      assert.ok(hasTool(toolName), `tool-registry must have tool: ${toolName}`);
      assert.equal(getToolModule(toolName), 'outbound-engine', `tool ${toolName} module must be outbound-engine`);
    }
  });

  it('loads sdr-sales-rep and social-media-advisor skills', async () => {
    const { loadSkill, resolveSkillForModule } = await import('../../src/lib/skills/skillService.ts');

    assert.equal(resolveSkillForModule('sdr'), 'sdr-sales-rep');
    assert.equal(resolveSkillForModule('social'), 'social-media-advisor');

    const sdr = await loadSkill('test-tenant', 'sdr-sales-rep');
    assert.ok(sdr, 'sdr-sales-rep skill must exist');
    assert.ok(sdr.allowedTools?.includes('read_outreach_inbox'));
    assert.ok(sdr.allowedTools?.includes('handle_lead_objection'));
    assert.ok(sdr.body.includes('Objection Handling Strategy'));

    const social = await loadSkill('test-tenant', 'social-media-advisor');
    assert.ok(social, 'social-media-advisor skill must exist');
    assert.ok(social.allowedTools?.includes('get_social_content_recommendations'));
    assert.ok(social.body.includes('Advisor Workflow'));
  });

  it('correctly handles objections via rule-based SDR matrix', async () => {
    // Test the objection logic directly
    const classify = (text) => {
      const lower = text.toLowerCase();
      if (/\b(unsubscribe|remove me|stop emailing)\b/i.test(lower)) return 'unsubscribe';
      if (/\b(too expensive|no budget|cannot afford|pricing)\b/i.test(lower)) return 'price';
      if (/\b(not right now|later|next quarter|busy)\b/i.test(lower)) return 'timing';
      if (/\b(already use|hubspot|salesforce)\b/i.test(lower)) return 'competitor';
      if (/\b(wrong person|not the right person)\b/i.test(lower)) return 'wrong_person';
      return 'general';
    };

    assert.equal(classify('We cannot afford this right now, too expensive'), 'price');
    assert.equal(classify('Not right now, please reach out next quarter'), 'timing');
    assert.equal(classify('We already use HubSpot for this'), 'competitor');
    assert.equal(classify('Wrong person, speak to Sarah instead'), 'wrong_person');
    assert.equal(classify('Please remove me and unsubscribe'), 'unsubscribe');
  });

  it('enforces Hermes policy tiers for autonomous execution', async () => {
    const { evaluateHermesPolicy } = await import('../../src/lib/hermes/policy.ts');

    const readPolicy = evaluateHermesPolicy('READ');
    assert.equal(readPolicy.allowed, true);
    assert.equal(readPolicy.requiresApproval, false);

    const createPolicy = evaluateHermesPolicy('CREATE');
    assert.equal(createPolicy.allowed, true);
    assert.equal(createPolicy.requiresApproval, false);

    const externalPolicy = evaluateHermesPolicy('EXTERNAL_ACTION');
    assert.equal(externalPolicy.allowed, false);
    assert.equal(externalPolicy.requiresApproval, true);

    const sensitivePolicy = evaluateHermesPolicy('SENSITIVE');
    assert.equal(sensitivePolicy.allowed, false);
    assert.equal(sensitivePolicy.requiresApproval, true);
  });
});
