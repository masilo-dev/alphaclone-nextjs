
import { routeAutonomousTask, cleanProfessionalContent } from '../aiRouter';

export interface VideoScriptOutput {
    hook: string;
    script: string;
    visualCues: string;
    controversyScore: number;
}

export interface XaiVideoGenerationResult {
    requestId: string;
    status: string;
    videoUrl?: string;
    expiresAt?: string;
    raw?: any;
}

export const xaiVideoGenerationService = {
    /**
     * Generates a high-engagement viral video script using xAI Grok.
     * Focuses on controversial business hooks to trigger views and engagement.
     */
    async generateViralScript(topic: string, intensity: 'standard' | 'high' = 'high'): Promise<VideoScriptOutput> {
        const systemPrompt = `
You are a viral social media strategist specializing in high-engagement video content for business owners.
Your goal is to generate a video script that starts with a "Pattern Interrupt" hook (Act 1).

Retention Engineering:
- Use "Curiosity Loops": Raise a question in Act 1 that isn't fully resolved until Act 3.
- Visual Tempo: Specify cuts or text overlays every 3-5 seconds to maintain attention.
- Authority Injection: Cite a specific statistic or logical sharp-reasoning point in Act 2.
- Intensity: ${intensity} (If high: Challenge industry norms or call out "fake experts").

Output format:
HOOK: [The first 3 seconds to stop the scroll]
SCRIPT: [The full 60-90 second script with clear pacing]
VISUALS: [Descriptions of text overlays and camera cuts]
CONTROVERSY_SCORE: [1-100]
`;

        const userPrompt = `Generate a viral business video script about: ${topic}. Make it controversial and engaging.`;

        const response = await routeAutonomousTask('social_article', `${systemPrompt}\n\n${userPrompt}`);
        const rawContent = response.content || '';

        // Parsing logic
        const hook = rawContent.match(/HOOK:?\s*(.*)/i)?.[1] || '';
        const script = rawContent.match(/SCRIPT:?\s*([\s\S]*?)(?=VISUALS:?|$)/i)?.[1] || '';
        const visuals = rawContent.match(/VISUALS:?\s*([\s\S]*?)(?=CONTROVERSY_SCORE:?|$)/i)?.[1] || '';
        const score = parseInt(rawContent.match(/CONTROVERSY_SCORE:?\s*(\d+)/i)?.[1] || '75');

        return {
            hook: hook.trim(),
            script: script.trim(),
            visualCues: visuals.trim(),
            controversyScore: score
        };
    },

    async generateVideo(params: {
        prompt: string;
        imageUrl?: string;
        duration?: number;
        poll?: boolean;
    }): Promise<XaiVideoGenerationResult> {
        const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
        if (!apiKey) {
            throw new Error('XAI_API_KEY or GROK_API_KEY is not configured.');
        }

        const duration = Number(params.duration || 8);
        const response = await fetch('https://api.x.ai/v1/videos/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: process.env.XAI_VIDEO_MODEL || 'grok-imagine-video',
                prompt: params.prompt.trim(),
                duration: Number.isFinite(duration) ? Math.min(Math.max(duration, 4), 12) : 8,
                ...(params.imageUrl ? { image: { url: params.imageUrl } } : {}),
            }),
        });

        const created = await response.json().catch(() => null);
        if (!response.ok) {
            throw new Error(created?.error?.message || created?.message || `xAI video generation failed (${response.status})`);
        }

        const requestId = String(created?.request_id || created?.id || '');
        if (!requestId) {
            throw new Error('xAI video generation did not return a request id.');
        }

        if (!params.poll) {
            return { requestId, status: 'queued', raw: created };
        }

        for (let attempt = 0; attempt < 36; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 5000));
            const pollResponse = await fetch(`https://api.x.ai/v1/videos/${requestId}`, {
                headers: { Authorization: `Bearer ${apiKey}` },
            });
            const polled = await pollResponse.json().catch(() => null);
            if (!pollResponse.ok) {
                throw new Error(polled?.error?.message || polled?.message || `xAI video poll failed (${pollResponse.status})`);
            }

            const status = String(polled?.status || '');
            if (status === 'done') {
                return {
                    requestId,
                    status,
                    videoUrl: polled?.video?.url,
                    expiresAt: polled?.video?.expires_at,
                    raw: polled,
                };
            }
            if (status === 'failed' || status === 'expired') {
                return { requestId, status, raw: polled };
            }
        }

        return { requestId, status: 'processing' };
    }
};
