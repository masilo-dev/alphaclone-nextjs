import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { resolveTenantContextForUser } from '@/lib/quotas/resolveTenantForAiRequest';
import { createSupabaseServerClient } from '@/lib/supabase-server';

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
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      leads,
      industry,
      tone = 'professional',
      customContext = '',
      senderName = 'the AlphaClone team',
      tenantId: bodyTenantId,
    }: {
      leads: LeadForGeneration[];
      industry: string;
      tone?: string;
      customContext?: string;
      senderName?: string;
      tenantId?: string;
    } = body;

    if (!leads?.length) {
      return NextResponse.json({ error: 'No leads provided' }, { status: 400 });
    }

    const ctx = await resolveTenantContextForUser(supabase, user.id, bodyTenantId ?? null);
    if (!ctx) {
      return NextResponse.json(
        {
          error: 'A workspace is required. Select your organization or pass tenantId.',
          code: 'TENANT_REQUIRED',
        },
        { status: 400 }
      );
    }

    const inbound = await headers();
    const cookieHeader = inbound.get('cookie') || '';
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
      'http://localhost:3000';

    const TONE_DESCRIPTIONS: Record<string, string> = {
      professional: 'formal, expert, and business-focused',
      friendly:     'warm, approachable, and conversational',
      direct:       'concise, punchy, and no fluff — 3 sentences max',
      value_add:    'lead with a free tip or insight before any ask',
    };

    const BATCH_SIZE = 5;
    const leadsToProcess = leads.slice(0, 20); // Cap at 20

    const batches = [];
    for (let i = 0; i < leadsToProcess.length; i += BATCH_SIZE) {
      batches.push(leadsToProcess.slice(i, i + BATCH_SIZE).map((l, idx) => ({
        index: i + idx,
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
      })));
    }

    const batchPromises = batches.map(async (batchLeadsJson) => {
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
${JSON.stringify(batchLeadsJson, null, 2)}

Return this exact JSON structure (array of objects):
[
  {
    "index": number, (MUST MATCH the index carefully)
    "subject": "...",
    "body": "..."
  }
]
`;
        try {
            const aiRes = await fetch(`${baseUrl.replace(/\/$/, '')}/api/ai/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(cookieHeader ? { Cookie: cookieHeader } : {}),
                },
                body: JSON.stringify({
                    prompt,
                    maxTokens: 4096,
                    tenantId: ctx.tenantId,
                }),
            });

            if (!aiRes.ok) throw new Error('AI generation failed');
            const { text } = await aiRes.json();
            if (!text) throw new Error('AI returned empty response');

            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (!jsonMatch) throw new Error('AI response was not valid JSON array');

            return JSON.parse(jsonMatch[0]) as Array<{ index: number; subject: string; body: string }>;
        } catch (e: unknown) {
            console.error('[Outreach/Generate Batch] Error:', e);
            // Fallback for failed batch
            return batchLeadsJson.map(b => ({
                index: b.index,
                subject: `Strategic Discussion - ${b.business}`,
                body: `Hello,\n\nI was reviewing ${b.business} and saw some unique opportunities in your local market.\n\nWould you be open to a brief 10-minute chat this week to discuss how we might be able to help?\n\nBest,\n${senderName}`
            }));
        }
    });

    const resultsBatches = await Promise.all(batchPromises);
    const generated: Array<{ index: number; subject: string; body: string }> = resultsBatches.flat();

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

  } catch (error: unknown) {
    console.error('[Outreach/Generate]', error);
    return clientErrorResponse(error, { request, scope: 'outreach/generate.POST' });
  }
}
