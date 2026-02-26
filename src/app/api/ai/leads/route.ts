import { NextResponse } from 'next/server';
import { routeAIRequest, getAvailableProviders } from '@/services/aiRouter';
import { googlePlacesService } from '@/services/googlePlacesService';
import { ENV } from '@/config/env';

export const runtime = 'nodejs';

/**
 * AI Lead Generation API Route
 * Now uses smart routing: Anthropic (Claude) → OpenAI (GPT-4) → Gemini
 * Automatically falls back if primary provider fails
 */
export async function POST(req: Request) {
    try {
        const { industry, location, filters } = await req.json();

        if (!industry || !location) {
            return NextResponse.json({ error: 'Industry and location are required' }, { status: 400 });
        }

        const googleApiKey = ENV.GOOGLE_API_KEY;
        let leads: any[] = [];
        let source = 'AI Simulated';
        let provider = 'Google';
        let model = 'Places API';

        let rawMapsData: any[] = [];

        // 1. Try real lookup first if API key is available
        if (googleApiKey) {
            console.log(`[Lead Gen] Attempting Google Places search for: ${industry} in ${location}`);
            const { places, rawResults, error: placesError } = await googlePlacesService.searchPlaces(`${industry} in ${location}`, googleApiKey);

            if (!placesError && places && places.length > 0) {
                console.log(`[Lead Gen] ✓ Found ${places.length} real leads from Google`);
                rawMapsData = rawResults || [];
                leads = places.map(p => ({
                    id: Math.random().toString(36).substring(2, 10),
                    ...p,
                    estimatedValue: Math.floor(Math.random() * (50000 - 5000 + 1)) + 5000,
                    notes: `Real business found via Google Maps. Matches "${industry}" in "${location}".`
                }));
                source = 'Google Maps';
                provider = 'Google';
                model = 'Search (New)';
            } else if (placesError) {
                console.warn(`[Lead Gen] Google Places error: ${placesError}. Falling back to AI...`);
            }
        }

        // 2. If no real leads or no API key, fallback to AI generation
        if (leads.length === 0) {
            console.log('[Lead Gen] Using AI fallback for fictional leads...');
            const prompt = `Generate EXACTLY 5 high-quality, highly realistic business leads for the following specification:
Target Service/Industry: "${industry}"
Location: "${location}"
${filters ? `\nADDITIONAL USER FILTERS TO STRICTLY OBEY:\n- ${filters}\n` : ''}

CRITICAL REQUIREMENTS:
- Match the SPECIFIC service description if provided.
- Business names MUST sound authentic, localized, and contextually appropriate. Avoid generic or cliché names.
- Contact details MUST be highly realistic for the specific location (e.g., use correct local area codes for phone numbers).
- Emails should follow professional patterns (e.g., info@domain.com, standard first.last@domain.com).
- Websites should plausibly match the business name.
- Return ONLY a raw JSON array. DO NOT wrap it in an object. DO NOT include any conversational text, markdown formatting, or explanations before or after the JSON.

Return a JSON array exactly matching this schema:
[
  {
    "id": "random 8-character string",
    "businessName": "Authentic Local Business Name LLC",
    "industry": "${industry}",
    "location": "${location}",
    "phone": "(XXX) XXX-XXXX",
    "email": "contact@authenticbusiness.com",
    "website": "https://www.authenticbusiness.com",
    "facebook": "businesshandle",
    "estimatedValue": 25000,
    "notes": "A brief 1-sentence AI analysis of why this lead is a strong fit based on the location and industry."
  }
]`;

            const aiResponse = await routeAIRequest({
                prompt,
                maxTokens: 2000,
                temperature: 0.8,
            });

            // Robust JSON parsing
            let cleanedContent = aiResponse.content;

            // Try to extract JSON array
            const arrayMatch = cleanedContent.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
                cleanedContent = arrayMatch[0];
            } else {
                // Try to extract JSON object as fallback
                const objectMatch = cleanedContent.match(/\{[\s\S]*\}/);
                if (objectMatch) {
                    cleanedContent = objectMatch[0];
                }
            }

            try {
                const parsed = JSON.parse(cleanedContent);
                leads = Array.isArray(parsed) ? parsed : (parsed.leads || parsed.data || [parsed]);
            } catch (jsonError) {
                console.error('[Lead Gen] Failed to parse AI leads JSON:', aiResponse.content);
                // Fallback to empty array instead of crashing entirely, 
                // client will handle empty state.
                leads = [];
            }

            source = `AI (${aiResponse.provider})`;
            provider = aiResponse.provider;
            model = aiResponse.model;
        }

        // 3. AI Verification Pass (using OpenAI/ChatGPT as requested)
        if (leads.length > 0 && ENV.OPENAI_API_KEY) {
            console.log('[Lead Gen] Running AI verification pass using OpenAI...');
            try {
                const verificationPrompt = `Analyze the following list of business leads for "${industry}" in "${location}".
For each lead, determine if it is "Verified" (likely a real, active business) or "Simulated" (AI-generated placeholder).
Also provide a "trustScore" from 0 to 100 based on its plausibility (address, phone format, web presence logic).

Leads to verify:
${JSON.stringify(leads.map(l => ({ name: l.businessName, site: l.website, phone: l.phone })), null, 2)}

Return a JSON object matching this schema:
{
  "verifications": [
    { "businessName": "Exact Name", "isVerified": true, "trustScore": 95, "analysis": "Brief 1-sentence verification logic" }
  ]
}`;

                const verificationResponse = await routeAIRequest({
                    prompt: verificationPrompt,
                    model: 'gpt-4-turbo', // Explicitly use ChatGPT/OpenAI for this
                    maxTokens: 1000,
                    temperature: 0.3,
                });

                try {
                    const vData = JSON.parse(verificationResponse.content.match(/\{[\s\S]*\}/)?.[0] || '{}');
                    if (vData.verifications) {
                        leads = leads.map(lead => {
                            const v = vData.verifications.find((v: any) => v.businessName === lead.businessName);
                            return {
                                ...lead,
                                isVerified: v ? v.isVerified : false,
                                trustScore: v ? v.trustScore : 50,
                                verificationNotes: v ? v.analysis : 'Verification pending'
                            };
                        });
                        console.log('[Lead Gen] ✓ AI Verification complete');
                    }
                } catch (pErr) {
                    console.warn('[Lead Gen] Verification parsing failed:', pErr);
                }
            } catch (vErr) {
                console.error('[Lead Gen] Verification pass failed:', vErr);
            }
        }

        return NextResponse.json({
            leads,
            provider,
            model,
            source,
            rawMapsData, // Include for audit
            isAIVerified: !!ENV.OPENAI_API_KEY && leads.length > 0
        });
    } catch (error: any) {
        console.error('Lead Generation API Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to generate leads'
        }, { status: 500 });
    }
}
