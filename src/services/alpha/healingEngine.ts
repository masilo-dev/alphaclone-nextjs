export type ErrorType = 'api_down' | 'rate_limited' | 'auth_expired' | 'model_confused';

interface HealingStrategy {
    detect: (error: any) => boolean;
    action: string;
    priority: number;
}

class HealingEngine {
    private strategies: Record<ErrorType, HealingStrategy> = {
        api_down: {
            detect: (e) => e.message?.includes('socket') || e.status === 503,
            action: 'Switch to backup provider (OpenAI -> Anthropic)',
            priority: 1
        },
        rate_limited: {
            detect: (e) => e.status === 429,
            action: 'Distribute load across secondary API keys',
            priority: 2
        },
        auth_expired: {
            detect: (e) => e.status === 401 || e.status === 403,
            action: 'Refresh token automatically via authService',
            priority: 1
        },
        model_confused: {
            detect: (e) => e.message?.includes('low_confidence'),
            action: 'Fallback to Claude-3-Opus for verification',
            priority: 3
        }
    };

    async heal(error: any): Promise<string | null> {
        for (const [type, strategy] of Object.entries(this.strategies)) {
            if (strategy.detect(error)) {
                console.warn(`HEALING_ENGINE: Detected ${type}. Executing: ${strategy.action}`);
                return strategy.action;
            }
        }
        return null;
    }
}

export const healingEngine = new HealingEngine();
