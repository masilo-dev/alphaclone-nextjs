/**
 * MCP Prompt: review_bonnie_patterns
 *
 * Registers an MCP prompt template that lets users (or Claude) review
 * and synthesize extracted Bonnie memory logs from dream sessions.
 */

export interface McpPrompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
  template: (args: Record<string, string>) => string;
}

export const reviewBonniePatternsPrompt: McpPrompt = {
  name: 'review_bonnie_patterns',
  description:
    'Reviews and synthesizes the extracted patterns and memory updates from Bonnie dreaming sessions. Helps identify key improvements to apply.',
  arguments: [
    {
      name: 'patterns_json',
      description: 'JSON string of patterns_extracted from a bonnie_dream_sessions record',
      required: true,
    },
    {
      name: 'memory_updates_json',
      description: 'JSON string of memory_updates from a bonnie_dream_sessions record',
      required: true,
    },
    {
      name: 'context',
      description: 'Optional business context or focus area for the review',
      required: false,
    },
  ],
  template: (args) => {
    const context = args.context ? `\nFocus area: ${args.context}` : '';
    return `You are Bonnie, AlphaClone's self-improving AI agent. Review the following extracted patterns and memory updates from a recent dreaming session.${context}

**Extracted Patterns:**
${args.patterns_json}

**Memory Updates:**
${args.memory_updates_json}

Your task:
1. Summarize the top 3 most critical patterns that need immediate attention.
2. Recommend which memory updates should be applied first and why.
3. Identify any contradictions or redundancies in the updates.
4. Suggest 2-3 concrete behavioral changes Bonnie should make going forward.

Be concise and actionable. Format your response as a structured report.`;
  },
};

export const executeFullBusinessLifecyclePrompt: McpPrompt = {
  name: 'execute_full_business_lifecycle',
  description:
    'Master prompt to orchestrate the end-to-end business lifecycle: Lead capture -> CRM -> Deals -> Contracts -> Invoicing -> Project tasks -> Email/Social marketing -> Analytics.',
  arguments: [
    {
      name: 'client_name',
      description: 'Name of the client or target business project',
      required: true,
    },
    {
      name: 'contract_amount',
      description: 'Total contract amount for invoicing and deal tracking (e.g. 5000)',
      required: false,
    },
    {
      name: 'campaign_goal',
      description: 'Goal for the outreach/social campaign phase',
      required: false,
    },
  ],
  template: (args) => {
    const amount = args.contract_amount ? ` (Amount: $${args.contract_amount})` : '';
    const goal = args.campaign_goal ? ` Campaign goal: ${args.campaign_goal}` : '';
    return `You are Bonnie, the AlphaClone Business OS AI agent. Execute the full end-to-end business lifecycle for client: "${args.client_name}"${amount}.${goal}

Follow this exact 6-step tool execution sequence:
1. **CRM Registration**: Call \`create_lead\` or \`create_contact\` for ${args.client_name}.
2. **Deal Creation**: Call \`create_deal\` associated with the contact/company.
3. **Contract Preparation**: Call \`create_contract\` with scope terms.
4. **Invoice Generation**: Call \`create_invoice\` for the agreed contract amount and \`mark_invoice_paid\` upon payment.
5. **Project Execution**: Call \`create_project\` and \`create_task\` to initialize project deliverables.
6. **Marketing & Amplification**: Call \`upload_media\` and \`create_social_post_with_media\` to publish launch announcements on LinkedIn and Facebook.

Perform each step sequentially using available MCP tools and report status after each phase.`;
  },
};

export const executeSocialMediaCampaignPrompt: McpPrompt = {
  name: 'execute_social_media_campaign',
  description:
    'Prompt template for launching multi-channel social media posts with media uploads across LinkedIn, Facebook, Instagram, and X.',
  arguments: [
    {
      name: 'caption',
      description: 'Post text content / copy',
      required: true,
    },
    {
      name: 'media_url_or_base64',
      description: 'Image/PDF/Video URL or base64 data string',
      required: false,
    },
    {
      name: 'platforms',
      description: 'Comma-separated target platforms (e.g. linkedin,facebook)',
      required: false,
    },
  ],
  template: (args) => {
    const platforms = args.platforms || 'linkedin,facebook';
    const mediaClause = args.media_url_or_base64
      ? `\n2. Call \`upload_media\` with the provided image/video/PDF content to obtain a \`media_asset_id\`.`
      : '';
    return `You are Bonnie, AlphaClone's Social Media AI agent. Execute a multi-platform social media campaign across: ${platforms}.

**Post Caption:**
${args.caption}

Execution steps:
1. Call \`get_social_identities\` to resolve target account \`identity_id\`s.${mediaClause}
3. Call \`create_social_post_with_media\` passing the target \`identity_id\` and caption.
4. Call \`verify_social_post_published\` to confirm live post URLs.

Return a summary receipt with all live post links.`;
  },
};

export const executeClientOnboardingPrompt: McpPrompt = {
  name: 'execute_client_onboarding',
  description:
    'Prompt template for onboarding a new client: CRM contact creation, deal pipeline, contract drafting, and initial deposit invoice.',
  arguments: [
    {
      name: 'contact_name',
      description: 'Contact person full name',
      required: true,
    },
    {
      name: 'email',
      description: 'Contact email address',
      required: true,
    },
    {
      name: 'company_name',
      description: 'Company name',
      required: true,
    },
    {
      name: 'deal_value',
      description: 'Value of deal / contract',
      required: false,
    },
  ],
  template: (args) => {
    const value = args.deal_value ? ` with deal value $${args.deal_value}` : '';
    return `Onboard new client "${args.company_name}" (Primary Contact: ${args.contact_name} <${args.email}>)${value}.

Steps:
1. Call \`create_contact\` with name "${args.contact_name}" and email "${args.email}".
2. Call \`create_deal\` for company "${args.company_name}".
3. Call \`create_contract\` for the engagement terms.
4. Call \`create_invoice\` for initial payment deposit.

Confirm completion with a summary of generated record IDs.`;
  },
};

/** Registry of all MCP prompts */
export const MCP_PROMPTS: McpPrompt[] = [
  reviewBonniePatternsPrompt,
  executeFullBusinessLifecyclePrompt,
  executeSocialMediaCampaignPrompt,
  executeClientOnboardingPrompt,
];

/**
 * Get a registered MCP prompt by name.
 */
export function getMcpPrompt(name: string): McpPrompt | undefined {
  return MCP_PROMPTS.find(p => p.name === name);
}

/**
 * List all registered MCP prompt names and descriptions.
 */
export function listMcpPrompts() {
  return MCP_PROMPTS.map(p => ({
    name: p.name,
    description: p.description,
    arguments: p.arguments,
  }));
}
