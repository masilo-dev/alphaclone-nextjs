
import { routeAutonomousTask, cleanProfessionalContent } from '../aiRouter';

export interface VideoScriptOutput {
    hook: string;
    script: string;
    visualCues: string;
    controversyScore: number;
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
    }
};
