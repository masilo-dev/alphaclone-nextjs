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
        let leads = [];
        let source = 'AI Simulated';
        let provider = 'Google';
        let model = 'Places API';

        // 1. Try real lookup first if API key is available
        if (googleApiKey) {
            console.log(`[Lead Gen] Attempting Google Places search for: ${industry} in ${location}`);
            const { places, error: placesError } = await googlePlacesService.searchPlaces(`${industry} in ${location}`, googleApiKey);

            if (!placesError && places && places.length > 0) {
                console.log(`[Lead Gen] ✓ Found ${places.length} real leads from Google`);
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
            const prompt = `Generate EXACTLY 5 high-quality, realistic business leads for the following specification:
Target Service/Industry: "${industry}"
Location: "${location}"
${filters ? `\nADDITIONAL USER FILTERS TO STRICTLY OBEY:\n- ${filters}\n` : ''}
CRITICAL REQUIREMENTS:
- Match the SPECIFIC service description if provided.
- All data must be plausible and realistic for ${location}.
- Return ONLY valid JSON.

Return a JSON array of objects with these keys:
- id: random 8-character string
- businessName: string
- industry: "${industry}"
- location: "${location}"
- phone: string
- email: string
- website: plausible website URL
- facebook: string (handle only)
- estimatedValue: number (5000-50000)
- notes: A brief 1-sentence AI analysis of why this lead is a good fit.`;

            const aiResponse = await routeAIRequest({
                prompt,
                maxTokens: 2000,
                temperature: 0.8,
            });

            // Clean response of markdown code blocks
            const cleanedContent = aiResponse.content
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();

            leads = JSON.parse(cleanedContent);
            source = `AI (${aiResponse.provider})`;
            provider = aiResponse.provider;
            model = aiResponse.model;
        }

        return NextResponse.json({
            leads,
            provider,
            model,
            source
        });
    } catch (error: any) {
        console.error('Lead Generation API Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to generate leads'
        }, { status: 500 });
    }
}
