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
    // --- Claude 3.5 Series (Current Flagships) ---
    { 
        id: 'claude-3-5-sonnet-20241022', 
        name: 'Claude 3.5 Sonnet (v2)', 
        description: 'Elite intelligence, breakthrough speed. Best for complex logic and coding.' 
    },
    { 
        id: 'claude-3-5-haiku-20241022', 
        name: 'Claude 3.5 Haiku', 
        description: 'The fastest, most intelligent small model in the world.' 
    },

    // --- Claude 4 Series (Next Generation / 2025-2026) ---
    { 
        id: 'claude-sonnet-4-6-20260217', 
        name: 'Claude 4.6 Sonnet', 
        description: 'Enterprise-grade orchestration and deep semantic reasoning.',
        isFuturistic: true
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

    // --- Claude 3 Series (Original) ---
    { 
        id: 'claude-3-opus-20240229', 
        name: 'Claude 3 Opus', 
        description: 'Legacy powerhouse. Excels at open-ended discussion and nuance.' 
    },
    { 
        id: 'claude-3-sonnet-20240229', 
        name: 'Claude 3 Sonnet', 
        description: 'Legacy Sonnet model. Solid performance for general tasks.',
        isLegacy: true
    },
    { 
        id: 'claude-3-haiku-20240307', 
        name: 'Claude 3 Haiku', 
        description: 'Lightweight and fast legacy model.',
        isLegacy: true
    }
];

export const DEFAULT_CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';
