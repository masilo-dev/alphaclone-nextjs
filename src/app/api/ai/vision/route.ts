import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { ENV } from '@/config/env';
import { UNITS_PER_VISION } from '@/config/aiUsageQuotas';
import { consumeAiUnitsOr429 } from '@/lib/quotas/tenantAiUnitsQuota';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase-server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_OPENROUTER_MODEL } from '@/config/aiModels';
import { requireTenantAccess } from '@/lib/apiAuth';
import { z } from 'zod';

export const maxDuration = 60; // Allow more time for AI vision processing
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        // Authenticate User & Validate Tenant
        const supabase = await createSupabaseServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get('file') as File;
        const tenantId = formData.get('tenantId') as string;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
        }

        const { admin } = await requireTenantAccess(tenantId, req);
        const { data: tenantRow } = await admin
            .from('tenants')
            .select('subscription_plan')
            .eq('id', tenantId)
            .maybeSingle();
        const plan = (tenantRow?.subscription_plan as string) || 'free';

        const usesRemoteAi = Boolean(ENV.OPENAI_API_KEY || ENV.ANTHROPIC_API_KEY || ENV.OPENROUTER_API_KEY);
        if (usesRemoteAi) {
            const blocked = await consumeAiUnitsOr429(admin, tenantId, plan, UNITS_PER_VISION);
            if (blocked) return blocked;
        }

        // 1. Convert File to Base64
        const buffer = await file.arrayBuffer();
        const base64Data = Buffer.from(buffer).toString('base64');
        const mimeType = file.type;

        // Ensure we only process supported image formats
        const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!supportedTypes.includes(mimeType)) {
            return NextResponse.json({ error: `Unsupported file type: ${mimeType}. Please upload a clear image (JPEG, PNG, WEBP).` }, { status: 400 });
        }
        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: 'Image must be 10 MB or smaller.' }, { status: 413 });
        }

        // 2. Determine which AI provider to use
        // Prioritize OpenAI for Vision (GPT-4o), fallback to Claude, and finally OpenRouter.
        let extractedData: any = null;
        const systemPrompt = `You are an expert accountant and data extraction AI.
        Please analyze the provided receipt or invoice image and extract the following information strictly in JSON format:
        {
          "date": "YYYY-MM-DD", (if no exact date, output null)
          "description": "Store name or brief description of items",
          "amount": 123.45, (pure number, no currency symbols)
          "currency": "USD", (detected currency code)
          "category": "Suggest a tax category (e.g., Office Supplies, Meals, Travel, Marketing, Utilities)",
          "confidence": 0-1
        }
        Do not output ANY markdown wrappers (\`\`\`json), just the raw JSON object. If you cannot determine a value, leave it null.`;

        // OpenAI attempt
        if (ENV.OPENAI_API_KEY && !extractedData) {
            try {
                const openai = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });
                const response = await openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt
                        },
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: 'Analyze this receipt and output the JSON.' },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: `data:${mimeType};base64,${base64Data}`
                                    }
                                }
                            ]
                        }
                    ],
                    temperature: 0,
                    max_tokens: 200,
                });

                const content = response.choices[0]?.message?.content?.trim() || '{}';
                const cleanJson = content.replace(/```json\n?|\n?```/g, '');
                extractedData = JSON.parse(cleanJson);
            } catch (err) {
                console.warn('Vision OCR: OpenAI failed, falling back:', err);
            }
        }

        // Anthropic attempt
        if (ENV.ANTHROPIC_API_KEY && !extractedData) {
            try {
                const anthropic = new Anthropic({ apiKey: ENV.ANTHROPIC_API_KEY });
                const response = await anthropic.messages.create({
                    model: 'claude-3-5-sonnet-latest',
                    max_tokens: 200,
                    temperature: 0,
                    system: systemPrompt,
                    messages: [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'image',
                                    source: {
                                        type: 'base64',
                                        media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                                        data: base64Data,
                                    },
                                },
                                { type: 'text', text: 'Analyze this receipt and output the JSON.' }
                            ],
                        }
                    ],
                });

                const block = response.content[0];
                if (block.type === 'text') {
                    const content = block.text.trim();
                    const cleanJson = content.replace(/```json\n?|\n?```/g, '');
                    extractedData = JSON.parse(cleanJson);
                }
            } catch (err) {
                console.warn('Vision OCR: Anthropic failed, falling back:', err);
            }
        }

        // OpenRouter attempt (final)
        if (ENV.OPENROUTER_API_KEY && !extractedData) {
            try {
                const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${ENV.OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://alphaclonesystems.com',
                        'X-Title': 'AlphaClone Systems',
                    },
                    body: JSON.stringify({
                        model: DEFAULT_OPENROUTER_MODEL,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            {
                                role: 'user',
                                content: [
                                    { type: 'text', text: 'Analyze this receipt and output the JSON.' },
                                    {
                                        type: 'image_url',
                                        image_url: {
                                            url: `data:${mimeType};base64,${base64Data}`,
                                        },
                                    },
                                ],
                            },
                        ],
                        temperature: 0,
                        max_tokens: 200,
                    }),
                });

                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error(`OpenRouter OCR error ${res.status}: ${errText}`);
                }

                const data = await res.json();
                const content = data?.choices?.[0]?.message?.content?.trim() || '{}';
                const cleanJson = content.replace(/```json\n?|\n?```/g, '');
                extractedData = JSON.parse(cleanJson);
            } catch (err) {
                console.warn('Vision OCR: OpenRouter failed, falling back:', err);
            }
        }

        // If no provider succeeded, return basic file info for manual entry
        if (!extractedData) {
            console.warn('No Vision-capable AI provider configured or all providers failed. Returning basic file info.');
            extractedData = {
                date: new Date().toISOString().split('T')[0],
                description: '',
                amount: 0,
                currency: 'USD',
                category: 'Uncategorized',
                confidence: 0
            };
        }

        const extractionSchema = z.object({
            date: z.string().nullable().optional(),
            description: z.string().nullable().optional(),
            amount: z.coerce.number().nonnegative().nullable().optional(),
            currency: z.string().length(3).nullable().optional(),
            category: z.string().nullable().optional(),
            confidence: z.coerce.number().min(0).max(1).optional(),
        });
        const parsedExtraction = extractionSchema.safeParse(extractedData);
        if (!parsedExtraction.success) {
            return NextResponse.json({ error: 'The receipt could not be read reliably. Enter its details manually.' }, { status: 422 });
        }
        extractedData = parsedExtraction.data;

        // 3. Upload File to Storage for records (optional but good practice)
        const extensionByMime: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
        const fileName = `receipt-${crypto.randomUUID()}.${extensionByMime[mimeType]}`;
        const filePath = `${tenantId}/receipts/${fileName}`;

        const { data: uploadData, error: uploadError } = await admin
            .storage
            .from('documents')
            .upload(filePath, file, { contentType: mimeType, upsert: false });

        if (uploadError || !uploadData) {
            throw new Error(`Receipt image could not be stored: ${uploadError?.message || 'upload failed'}`);
        }
        const fileUrl = `/api/storage/documents/${filePath}`;

        // Return extracted data + receipt URL
        return NextResponse.json({
            success: true,
            data: {
                date: extractedData.date || new Date().toISOString().split('T')[0],
                description: extractedData.description,
                amount: extractedData.amount,
                category: extractedData.category,
                receiptUrl: fileUrl
            }
        });

    } catch (error: any) {
        console.error('OCR/Vision processing error:', error);
        return clientErrorResponse(error, { request: req, scope: 'ai/vision' });
    }
}
