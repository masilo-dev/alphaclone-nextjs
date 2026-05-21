import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { resolveTenantContextForUser } from '@/lib/quotas/resolveTenantForAiRequest';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getCampaignLanguageInstruction, resolveCampaignLanguage } from '@/lib/languageUtils';

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
  countryCode?: string;
  country?: string;
}

interface GeneratedEmail {
  business_name: string;
  subject:       string;
  body:          string;
  pitchAngle:    string;
  recipientEmail: string | null;
  recipientSource: 'lead' | 'inferred' | 'none';
  language?: string;
  languageLabel?: string;
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

function inferBusinessEmail(lead: LeadForGeneration): string | null {
  const directEmail = String(lead.email || '').trim();
  if (directEmail.includes('@')) {
    return directEmail.toLowerCase();
  }

  const rawWebsite = String(lead.website || '').trim();
  if (!rawWebsite) return null;

  try {
    const normalizedUrl = rawWebsite.startsWith('http://') || rawWebsite.startsWith('https://')
      ? rawWebsite
      : `https://${rawWebsite}`;
    const url = new URL(normalizedUrl);
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    if (!host || host.includes('localhost') || !host.includes('.')) return null;
    return `info@${host}`;
  } catch {
    return null;
  }
}

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
      languageMode = 'auto',
    }: {
      leads: LeadForGeneration[];
      industry: string;
      tone?: string;
      customContext?: string;
      senderName?: string;
      tenantId?: string;
      languageMode?: string;
    } = body;

    if (!leads?.length) {
      return NextResponse.json({ error: 'No leads provided' }, { status: 400 });
    }
    if (resolveCampaignLanguage({ languageMode }).mustAsk) {
      return NextResponse.json({ error: 'Choose a language before generating outreach, or use languageMode "auto".' }, { status: 400 });
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
        hasEmail:   !!inferBusinessEmail(l),
        hasPhone:   !!l.phone,
        hasWebsite: !!l.website,
        rating:     l.rating,
        address:    l.address,
        countryCode: l.countryCode,
        country: l.country,
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
${getCampaignLanguageInstruction({ languageMode, country: batchLeadsJson[0]?.country, countryCode: batchLeadsJson[0]?.countryCode, address: batchLeadsJson[0]?.address, company: batchLeadsJson[0]?.business })}

RULES:
- Each email must be 80–140 words maximum
- Subject line: punchy, specific to the business, max 8 words
- Never use generic openers like "I hope this finds you well"
- Reference the specific business name and industry
- For pitch angle "digital-presence": urgently highlight they have NO website and what they're losing
- For pitch angle "reputation-management": reference their low rating subtly without being harsh
- For leads where hasEmail is false: write a 60-word PHONE CALL SCRIPT instead of an email body
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
      const inferredRecipient = lead ? inferBusinessEmail(lead) : null;
      const directEmail = String(lead?.email || '').trim();
      const recipientEmail = directEmail.includes('@') ? directEmail.toLowerCase() : inferredRecipient;
      const recipientSource: 'lead' | 'inferred' | 'none' = directEmail.includes('@')
        ? 'lead'
        : recipientEmail
          ? 'inferred'
          : 'none';
      const language = resolveCampaignLanguage({
        languageMode,
        country: lead?.country,
        countryCode: lead?.countryCode,
        address: lead?.address,
        company: lead?.business_name,
      });
      return {
        business_name: lead?.business_name || `Lead ${g.index}`,
        subject:       g.subject,
        body:          g.body,
        pitchAngle:    lead?.pitchAngle || 'growth-opportunity',
        recipientEmail,
        recipientSource,
        language: language.code,
        languageLabel: language.label,
      };
    });

    return NextResponse.json({ success: true, emails });

  } catch (error: unknown) {
    console.error('[Outreach/Generate]', error);
    return clientErrorResponse(error, { request, scope: 'outreach/generate.POST' });
  }
}
