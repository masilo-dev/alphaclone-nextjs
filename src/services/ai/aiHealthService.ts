import { getAvailableProviders, routeAIRequest } from '../aiRouter';

export interface HealthStatus {
    provider: string;
    status: 'healthy' | 'degraded' | 'failed';
    message: string;
    latency?: number;
    lastChecked: Date;
}

class AIHealthService {
    private healthCache: Map<string, HealthStatus> = new Map();

    /**
     * Perform a lightweight health check on all configured providers
     */
    async checkAll(): Promise<HealthStatus[]> {
        const providers = getAvailableProviders();
        const checks: Promise<HealthStatus>[] = [];

        if (providers.anthropic) checks.push(this.checkAnthropic());
        if (providers.openai) checks.push(this.checkOpenAI());
        if (providers.gemini) checks.push(this.checkGemini());

        const results = await Promise.all(checks);
        results.forEach(res => this.healthCache.set(res.provider, res));
        return results;
    }

    private async checkAnthropic(): Promise<HealthStatus> {
        const start = Date.now();
        try {
            // Placeholder key check
            if (process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key') {
                return {
                    provider: 'Anthropic',
                    status: 'failed',
                    message: 'API Key is still a placeholder in .env',
                    lastChecked: new Date()
                };
            }

            // Minimal heartbeat request
            await routeAIRequest({
                prompt: 'ping',
                model: 'claude-haiku-4-5-20251015',
                maxTokens: 1
            });

            return {
                provider: 'Anthropic',
                status: 'healthy',
                message: 'Connected successfully',
                latency: Date.now() - start,
                lastChecked: new Date()
            };
        } catch (error: any) {
            return {
                provider: 'Anthropic',
                status: error.status === 401 ? 'failed' : 'degraded',
                message: error.message,
                lastChecked: new Date()
            };
        }
    }

    private async checkOpenAI(): Promise<HealthStatus> {
        const start = Date.now();
        try {
            if (process.env.OPENAI_API_KEY === 'your_openai_api_key') {
                return {
                    provider: 'OpenAI',
                    status: 'failed',
                    message: 'API Key is still a placeholder in .env',
                    lastChecked: new Date()
                };
            }

            await routeAIRequest({
                prompt: 'ping',
                model: 'gpt-3.5-turbo',
                maxTokens: 1
            });

            return {
                provider: 'OpenAI',
                status: 'healthy',
                message: 'Connected successfully',
                latency: Date.now() - start,
                lastChecked: new Date()
            };
        } catch (error: any) {
            return {
                provider: 'OpenAI',
                status: error.status === 429 ? 'degraded' : 'failed',
                message: error.message,
                lastChecked: new Date()
            };
        }
    }

    private async checkGemini(): Promise<HealthStatus> {
        return {
            provider: 'Gemini',
            status: 'degraded',
            message: 'Gemini health check not yet fully implemented',
            lastChecked: new Date()
        };
    }

    getHealth(): HealthStatus[] {
        return Array.from(this.healthCache.values());
    }
}

export const aiHealthService = new AIHealthService();
