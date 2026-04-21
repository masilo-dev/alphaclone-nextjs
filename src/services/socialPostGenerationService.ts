import { routeAutonomousTask, cleanProfessionalContent } from '@/services/aiRouter';

export type SocialPlatform = 'linkedin' | 'facebook';
export type ContentPillar =
  | 'behind_the_scenes'
  | 'client_results'
  | 'contrarian_take'
  | 'tactical_how_to'
  | 'personal_brand';

type GenerateInput = {
  platform: SocialPlatform;
  pillar: ContentPillar;
  topic: string;
  monthlyGoal?: string;
  includeCta?: boolean;
};

type GenerateOutput = {
  content: string;
  strategistNotes: string;
  reviewerNotes: string;
  confidenceScore: number;
};

function getPlatformRules(platform: SocialPlatform): string {
  if (platform === 'linkedin') {
    return [
      'Tone: professional, insight-led, no fluff.',
      'Structure: hook on line 1, narrative + business lesson.',
      'Length target: 900-1300 characters.',
      'Hashtags: maximum 3 and only targeted tags.',
      'No emoji and no generic motivational phrases.',
    ].join('\n');
  }
  return [
    'Tone: conversational, practical, community-first.',
    'Structure: short opening hook, concrete value, clear CTA.',
    'Thread-first style: make opening sentence invite discussion.',
    'No emoji and no generic motivational phrases.',
    'Prefer concise readability and direct examples.',
  ].join('\n');
}

function getPillarFrame(pillar: ContentPillar): string {
  switch (pillar) {
    case 'behind_the_scenes':
      return 'Reveal a real operational process change and what it improved.';
    case 'client_results':
      return 'Use a case-study format with before/after outcomes.';
    case 'contrarian_take':
      return 'Challenge a common industry assumption with evidence.';
    case 'tactical_how_to':
      return 'Deliver practical steps the audience can use immediately.';
    case 'personal_brand':
      return 'Use founder perspective tied to a practical business lesson.';
    default:
      return 'Provide a concrete insight with a specific action.';
  }
}

function buildDeterministicFallback(platform: SocialPlatform, topic: string): string {
  if (platform === 'linkedin') {
    return [
      `Most teams do not lose deals because of product quality. They lose deals because follow-up quality is inconsistent.`,
      ``,
      `We applied a stricter system to ${topic}. The result was less drift, clearer ownership, and faster execution on critical conversations.`,
      ``,
      `Key change: every signal now maps to one concrete next action with an owner and deadline.`,
      ``,
      `If your revenue process still depends on memory, replace memory with operational structure.`,
      ``,
      `If useful, I can share the operating checklist we used to implement this.`,
    ].join('\n');
  }
  return [
    `Quick operational lesson from this week: ${topic}.`,
    ``,
    `We tightened our process to reduce missed follow-ups and improve consistency.`,
    `The biggest gain was not speed. It was reliability.`,
    ``,
    `If your team wants better outcomes, start by defining clear next actions for every lead and every invoice.`,
    ``,
    `What part of your workflow still depends too much on memory?`,
  ].join('\n');
}

export const socialPostGenerationService = {
  async generateMultiPass(input: GenerateInput): Promise<GenerateOutput> {
    const platformRules = getPlatformRules(input.platform);
    const pillarFrame = getPillarFrame(input.pillar);
    const includeCta = input.includeCta !== false;

    const strategistPrompt = `
You are the strategist agent.
Goal: Create a precise content brief.
Platform: ${input.platform}
Topic: ${input.topic}
Monthly goal: ${input.monthlyGoal || 'Lead generation and authority growth'}
Pillar frame: ${pillarFrame}
Rules:
${platformRules}

Return exactly:
1) Hook idea
2) Core argument
3) Proof point suggestion
4) CTA angle
5) Risk checks (what to avoid)
`;

    const strategist = await routeAutonomousTask('strategy', strategistPrompt);
    const strategistNotes = cleanProfessionalContent(strategist.content || '');

    const executorPrompt = `
You are the executor agent writing the final post.
Use this strategic brief:
${strategistNotes}

Write one final ${input.platform} post about "${input.topic}".
Requirements:
- Must be specific, not generic.
- Must include one concrete insight and one practical implication.
- ${includeCta ? 'Must include a clear CTA.' : 'CTA optional.'}
- Must follow platform rules below:
${platformRules}
`;

    const executorTask = input.platform === 'linkedin' ? 'social_article' : 'social_caption';
    const executor = await routeAutonomousTask(executorTask, executorPrompt);
    let draft = cleanProfessionalContent(executor.content || '');
    if (!draft.trim()) {
      draft = buildDeterministicFallback(input.platform, input.topic);
    }

    const reviewerPrompt = `
You are the reviewer agent.
Review this ${input.platform} post for:
1) clarity
2) specificity
3) platform fit
4) CTA quality
5) risk of sounding generic

Post:
${draft}

Return:
- Revised post
- Confidence score from 0 to 100
- One-line rationale
`;

    const reviewer = await routeAutonomousTask('strategy', reviewerPrompt);
    const reviewerRaw = cleanProfessionalContent(reviewer.content || '');

    const scoreMatch = reviewerRaw.match(/(\b\d{2,3}\b)/);
    const parsedScore = scoreMatch ? Number(scoreMatch[1]) : 82;
    const confidenceScore = Math.max(0, Math.min(100, parsedScore));

    const revisedMarker = reviewerRaw.toLowerCase().indexOf('revised post');
    const revisedPost =
      revisedMarker >= 0
        ? reviewerRaw.slice(revisedMarker).replace(/revised post[:\-\s]*/i, '').trim()
        : reviewerRaw.trim();

    const finalContent = revisedPost.length >= 120 ? revisedPost : draft;

    return {
      content: finalContent,
      strategistNotes,
      reviewerNotes: reviewerRaw,
      confidenceScore,
    };
  },
};

