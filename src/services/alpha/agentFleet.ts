export type AgentRole = 'strategist' | 'researcher' | 'executor' | 'qa' | 'learning' | 'support';

export interface AgentConfig {
    id: AgentRole;
    model: string;
    role: string;
    description: string;
    tools?: string[];
    parallel?: boolean;
    instances?: number;
    checkpoints?: string[];
}

export const AGENT_FLEET: Record<AgentRole, AgentConfig> = {
    strategist: {
        id: 'strategist',
        model: 'claude-sonnet-4-6-20260217', // Using 4.6 Sonnet for elite reasoning
        role: 'Mission Architect',
        description: 'Decomposes complex goals into actionable sub-tasks and sequences.'
    },
    researcher: {
        id: 'researcher',
        model: 'claude-sonnet-4-6-20260217',
        role: 'Intelligence Gatherer',
        description: 'Performs deep platform audits and gathers real-time data (Leads, Enrichment).',
        tools: ['lead_prospector', 'semantic_assistant', 'data_enricher']
    },
    executor: {
        id: 'executor',
        model: 'claude-haiku-4-5-20251015', // Haiku 4.5 for extreme speed
        role: 'Action Specialist',
        description: 'Executes real-world actions (Emails, Contracts, Deal Conversion) at high speed.',
        parallel: true,
        instances: 5,
        tools: ['outreach_executive', 'productivity_scheduler', 'notifier', 'contract_drafter', 'lead_to_deal']
    },
    qa: {
        id: 'qa',
        model: 'claude-sonnet-4-6-20260217', // Sonnet 4.6 for high precision
        role: 'Quality Assurance',
        description: 'Validates agent outputs for tone, accuracy, and compliance before finalization.',
        checkpoints: ['tone', 'accuracy', 'compliance']
    },
    learning: {
        id: 'learning',
        model: 'claude-sonnet-4-6-20260217',
        role: 'Evolution Engine',
        description: 'Analyzes mission outcomes to refine future strategies and patterns.'
    },
    support: {
        id: 'support' as any,
        model: 'gpt-4o', // Using GPT-4o for helpful, chatty customer support
        role: 'Bonnie',
        description: 'Customer success specialist (Bonnie) that answers FAQs and helps users navigate the platform.',
        tools: ['semantic_assistant', 'productivity_scheduler']
    }
};



