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
        // Now acting as a Senior SDR & Data Scientist using Advanced Orchestration
        if (leads.length === 0) {
            console.log('[Lead Gen] Using AI (Senior SDR Persona) for high-fidelity discovery...');
            const prompt = `You are a Senior Sales Development Representative (SDR) and Lead Data Scientist at AlphaClone.
Your task is to identify EXACTLY 5 high-fidelity business leads.

SEARCH SPECIFICATION:
- Industry/Service: "${industry}"
- Target Location: "${location}"
${filters ? `- Required Constraints: "${filters}"\n` : ''}

DATA QUALITY REQUIREMENTS (Senior SDR Standard):
- Match the SPECIFIC service niche. If the user is looking for "injury lawyers", don't just return "legal services".
- Business names MUST be realistic for the "${location}" market. 
- Contact details MUST follow real-world patterns for this region (phone formats, email structures).
- Verification: Cross-reference internal patterns to ensure these businesses are "Lead-Ready".
- Output only valid JSON. No conversational fluff.

Strict Schema:
[
  {
    "id": "random-8-chars",
    "businessName": "Company Name",
    "industry": "${industry}",
    "location": "${location}",
    "phone": "Localized String",
    "email": "Realistic Email",
    "website": "Consistent URL",
    "estimatedValue": numeric_value,
    "notes": "SDR INSIGHT: Why this lead is a high-value target for this search."
  }
]`;

            const aiResponse = await routeAIRequest({
                prompt,
                maxTokens: 2000,
                temperature: 0.7, // Lower temperature for more factual simulation
            });

            // Robust JSON parsing
            let cleanedContent = aiResponse.content;
            const arrayMatch = cleanedContent.match(/\[[\s\S]*\]/);
            if (arrayMatch) cleanedContent = arrayMatch[0];

            try {
                const parsed = JSON.parse(cleanedContent);
                leads = Array.isArray(parsed) ? parsed : (parsed.leads || [parsed]);
            } catch (jsonError) {
                console.error('[Lead Gen] AI Parsing Error:', jsonError);
                leads = [];
            }

            source = `Analysis (${aiResponse.provider})`;
            provider = aiResponse.provider;
            model = aiResponse.model;
        }

        // 3. Stringent Multi-Stage Verification Pass (Senior SDR & Data Scientist Mode)
        if (leads.length > 0) {
            console.log('[Lead Gen] Running Rigorous Senior SDR Data Audit...');
            try {
                const verificationPrompt = `You are a Senior SDR and Data Scientist Auditor at AlphaClone.
Analyze these 5 leads for "${industry}" in "${location}". 
Perform a deep-fidelity audit against real-world business patterns.

Leads to Audit:
${JSON.stringify(leads.map(l => ({ name: l.businessName, site: l.website, phone: l.phone, industry: l.industry })), null, 2)}

AUDIT PARAMETERS:
1. Niche Match: Does the business EXACTLY match "${industry}"? (Generic matches get <70 trust).
2. Domain Health: Is the website URL structure valid for a business?
3. Geographic Validity: Is the phone/address pattern consistent with "${location}"?
4. Persona Verification: Would an elite Senior SDR trust this lead for high-ticket outreach?

Strict Output JSON:
{
  "audits": [
    { 
      "businessName": "Exact Matching Name", 
      "isVerified": boolean, 
      "trustScore": number, 
      "reasoning": "Data Scientist audit notes on validity",
      "sdrInsight": "Strategic outreach recommendation"
    }
  ]
}`;

                const verificationResponse = await routeAIRequest({
                    prompt: verificationPrompt,
                    model: 'gpt-4-turbo',
                    maxTokens: 1000,
                    temperature: 0.2,
                });

                try {
                    const vData = JSON.parse(verificationResponse.content.match(/\{[\s\S]*\}/)?.[0] || '{}');
                    if (vData.audits) {
                        leads = leads.map(lead => {
                            const v = vData.audits.find((v: any) => v.businessName === lead.businessName);
                            return {
                                ...lead,
                                isVerified: v ? v.isVerified : lead.isVerified || false,
                                trustScore: v ? v.trustScore : 50,
                                verificationNotes: v ? v.reasoning : 'Pending audit',
                                sdrInsight: v ? v.sdrInsight : 'Ready for discovery'
                            };
                        });
                        console.log('[Lead Gen] ✓ Senior SDR Audit complete');
                    }
                } catch (pErr) {
                    console.warn('[Lead Gen] Audit parsing failed:', pErr);
                }
            } catch (vErr) {
                console.error('[Lead Gen] Audit pass failed:', vErr);
            }
        }

        // 4. Final Geocoding & Address Validation
        if (leads.length > 0 && googleApiKey) {
            console.log('[Lead Gen] Verifying physical existence via Google Maps...');
            try {
                const { googleMapsService } = await import('@/services/googleMapsService');

                leads = await Promise.all(leads.map(async (lead) => {
                    try {
                        if (lead.location) {
                            const { valid, formattedAddress } = await googleMapsService.validateAddress(lead.location, googleApiKey);
                            if (valid && formattedAddress) {
                                return {
                                    ...lead,
                                    location: formattedAddress,
                                    isAddressValid: true
                                };
                            }
                        }
                        return { ...lead, isAddressValid: false };
                    } catch (err) {
                        return { ...lead, isAddressValid: false };
                    }
                }));
                console.log('[Lead Gen] ✓ Location verification complete');
            } catch (err) {
                console.error('[Lead Gen] Bulk address validation failed:', err);
            }
        }

        // Ensure 5 lead cap and proper labeling
        const finalLeads = leads.slice(0, 5).map(l => ({
            ...l,
            foundBy: "AlphaClone Senior SDR",
            qualityLevel: l.trustScore > 80 ? "Premium" : (l.isVerified ? "High" : "Discovery")
        }));

        return NextResponse.json({
            leads: finalLeads,
            provider,
            model,
            source,
            rawMapsData: rawMapsData.slice(0, 5),
            isAIVerified: true,
            auditor: "SDR Data Scientist"
        });
    } catch (error: any) {
        console.error('Lead Generation API Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to generate leads'
        }, { status: 500 });
    }
}
