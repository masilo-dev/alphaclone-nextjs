import { NextResponse } from 'next/server';

// ── Types ──────────────────────────────────────────────────────────────────────
interface LeadForGeneration {
  business_name: string;
  email?:     string;
  phone?:     string;
  website?:   string;
  address?:   string;
  rating?:    number;
  category?:  string;
  pitchAngle: string;
  insights:   string[];
  score:      number;
}

interface GeneratedEmail {
  business_name: string;
  subject:       string;
  body:          string;
  pitchAngle:    string;
}

const PITCH_HOOKS: Record<string, string> = {
  'digital-presence':      'they have no website — this is your strongest pitch for web/digital services',
  'reputation-management': 'they have a low rating — pitch reputation management and review building',
  'patient-acquisition':   'they are a healthcare practice — focus on growing their patient base',
  'strategic-partnership': 'they are a professional firm — position as a strategic growth partner',
  'digital-partnership':   'they are a digital/tech business — explore white-label or referral partnership',
  'online-visibility':     'they are in auto/transport — focus on Google Maps visibility and local search',
  'e-commerce-opportunity':'they are a retail store — pitch e-commerce expansion or online presence',
  'parent-outreach':       'they are an education provider — help them reach parents actively seeking services',
  'growth-opportunity':    'this is a general local business — focus on lead generation and growth',
  'low-rating-recovery':   'their rating is below 3 stars — urgency around reputation recovery',
  'no-email-follow-up':    'no email found — produce a cold CALL script instead of an email',
};

/**
 * POST /api/outreach/generate
 * Generates personalized outreach emails for an array of leads.
 * Uses the existing /api/ai/generate proxy (Gemini → OpenAI → Claude).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      leads,
      industry,
      tone = 'professional',
      customContext = '',
      senderName = 'the AlphaClone team',
    }: {
      leads: LeadForGeneration[];
      industry: string;
      tone?: string;
      customContext?: string;
      senderName?: string;
    } = body;

    if (!leads?.length) {
      return NextResponse.json({ error: 'No leads provided' }, { status: 400 });
    }

    const TONE_DESCRIPTIONS: Record<string, string> = {
      professional: 'formal, expert, and business-focused',
      friendly:     'warm, approachable, and conversational',
      direct:       'concise, punchy, and no fluff — 3 sentences max',
      value_add:    'lead with a free tip or insight before any ask',
    };

    // Build one batch prompt (all leads in one API call → faster, cheaper)
    const leadsJson = leads.slice(0, 20).map((l, i) => ({
      index: i,
      business: l.business_name,
      industry,
      category: l.category || industry,
      hasEmail:   !!l.email,
      hasPhone:   !!l.phone,
      hasWebsite: !!l.website,
      rating:     l.rating,
      address:    l.address,
      pitchAngle: l.pitchAngle,
      pitchContext: PITCH_HOOKS[l.pitchAngle] || PITCH_HOOKS['growth-opportunity'],
      qualityScore: l.score,
    }));

    const prompt = `
You are an elite B2B sales copywriter. Generate hyper-personalized cold outreach emails for the leads below.

SENDER: ${senderName}
INDUSTRY SEARCHED: ${industry}
TONE: ${TONE_DESCRIPTIONS[tone] || TONE_DESCRIPTIONS.professional}
${customContext ? `ADDITIONAL CONTEXT FROM USER: ${customContext}` : ''}

RULES:
- Each email must be 80–140 words maximum
- Subject line: punchy, specific to the business, max 8 words
- Never use generic openers like "I hope this finds you well"
- Reference the specific business name and industry
- For pitch angle "digital-presence": urgently highlight they have NO website and what they're losing
- For pitch angle "reputation-management": reference their low rating subtly without being harsh
- For pitch angle "no-email-follow-up": write a 60-word PHONE CALL SCRIPT instead
- End with ONE clear, low-pressure CTA (e.g. "Worth a quick 10-min call?")
- Do NOT use asterisks, hashtags, or markdown symbols
- Return ONLY valid JSON array, no other text

LEADS:
${JSON.stringify(leadsJson, null, 2)}

Return this exact JSON structure (array of objects):
[
  {
    "index": 0,
    "subject": "...",
    "body": "..."
  }
]
`;

    // Call the existing AI proxy
    const aiRes = await fetch(`${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, maxTokens: 4096 }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.json();
      throw new Error(err.error || 'AI generation failed');
    }

    const { text } = await aiRes.json();
    if (!text) throw new Error('AI returned empty response');

    // Parse JSON from AI response (may have markdown wrapper)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('AI response was not valid JSON array');

    const generated: Array<{ index: number; subject: string; body: string }> = JSON.parse(jsonMatch[0]);

    // Merge with original lead data
    const emails: GeneratedEmail[] = generated.map(g => {
      const lead = leads[g.index];
      return {
        business_name: lead?.business_name || `Lead ${g.index}`,
        subject:       g.subject,
        body:          g.body,
        pitchAngle:    lead?.pitchAngle || 'growth-opportunity',
      };
    });

    return NextResponse.json({ success: true, emails });

  } catch (error: any) {
    console.error('[Outreach/Generate]', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
