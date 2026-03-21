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
        model: 'claude-sonnet-4-6-20260217', // Using latest 4.6 for reasoning
        role: 'Mission Architect',
        description: 'Decomposes complex goals into actionable sub-tasks and sequences.'
    },
    researcher: {
        id: 'researcher',
        model: 'claude-sonnet-4-5-20250929',
        role: 'Intelligence Gatherer',
        description: 'Performs deep platform audits and gathers real-time data for execution.',
        tools: ['lead_prospector', 'semantic_assistant']
    },
    executor: {
        id: 'executor',
        model: 'claude-haiku-4-5-20251015', // Haiku 4.5 for speed
        role: 'Action Specialist',
        description: 'Executes specific tasks at high speed with parallel capabilities.',
        parallel: true,
        instances: 5,
        tools: ['outreach_executive', 'productivity_scheduler', 'notifier']
    },
    qa: {
        id: 'qa',
        model: 'claude-sonnet-4-5-20250929', // Sonnet 4.5 for high precision
        role: 'Quality Assurance',
        description: 'Validates agent outputs for tone, accuracy, and compliance before finalization.',
        checkpoints: ['tone', 'accuracy', 'compliance']
    },
    learning: {
        id: 'learning',
        model: 'claude-sonnet-4-6-20260217',
        role: 'Evolution Engine',
        description: 'Analyzes mission outcomes to refine future strategies and patterns.'
    }
};
