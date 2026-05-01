/**
 * Claude AI Model Registry
 * Central source of truth for all supported Anthropic models
 */

export interface ClaudeModel {
    id: string;
    name: string;
    description: string;
    isFuturistic?: boolean;
    isLegacy?: boolean;
}

export const CLAUDE_MODELS: ClaudeModel[] = [
    // --- Claude 4 Series (Next Generation / 2025-2026) ---
    { 
        id: 'claude-sonnet-4-6-20260217', 
        name: 'Claude 4.6 Sonnet', 
        description: 'Elite intelligence, deep semantic reasoning. The current system flagship.',
        isFuturistic: false // Now current
    },
    { 
        id: 'claude-sonnet-4-5-20250929', 
        name: 'Claude 4.5 Sonnet', 
        description: 'Next-gen intelligence with 1M+ context window capacity.',
        isFuturistic: true
    },
    { 
        id: 'claude-haiku-4-5-20251015', 
        name: 'Claude 4.5 Haiku', 
        description: 'Instantaneous response with Claude 3.5 Opus-level intelligence.',
        isFuturistic: true
    },

    // --- OpenAI Series (Modern) ---
    {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'Omni model from OpenAI. High-performance multi-modal intelligence.'
    },
    {
        id: 'gpt-4o-mini',
        name: 'GPT-4o mini',
        description: 'Affordable and intelligent small model.'
    },

    // --- xAI Grok Series (2026) ---
    {
        id: 'grok-4.3',
        name: 'Grok-4.3',
        description: 'Latest high-performance model from xAI. Superior reasoning and speed.'
    },
    {
        id: 'grok-4',
        name: 'Grok-4 Vision',
        description: 'Multi-modal Grok model with advanced image and document understanding.'
    }
];

export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-6-20260217';
export const DEFAULT_OPENAI_MODEL = 'gpt-4o';
