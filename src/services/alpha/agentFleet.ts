export type AgentRole = 'strategist' | 'researcher' | 'executor' | 'qa' | 'learning';

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
        model: 'claude-3-5-sonnet-20240620', // Using Sonnet for reasoning
        role: 'Mission Architect',
        description: 'Decomposes complex goals into actionable sub-tasks and sequences.'
    },
    researcher: {
        id: 'researcher',
        model: 'claude-3-5-sonnet-20240620',
        role: 'Intelligence Gatherer',
        description: 'Performs deep platform audits and gathers real-time data for execution.',
        tools: ['lead_prospector', 'semantic_assistant']
    },
    executor: {
        id: 'executor',
        model: 'claude-3-haiku-20240307', // Haiku for speed
        role: 'Action Specialist',
        description: 'Executes specific tasks at high speed with parallel capabilities.',
        parallel: true,
        instances: 5,
        tools: ['outreach_executive', 'productivity_scheduler', 'notifier']
    },
    qa: {
        id: 'qa',
        model: 'claude-3-5-sonnet-20240620', // Sonnet for high precision
        role: 'Quality Assurance',
        description: 'Validates agent outputs for tone, accuracy, and compliance before finalization.',
        checkpoints: ['tone', 'accuracy', 'compliance']
    },
    learning: {
        id: 'learning',
        model: 'claude-3-5-sonnet-20240620',
        role: 'Evolution Engine',
        description: 'Analyzes mission outcomes to refine future strategies and patterns.'
    }
};
