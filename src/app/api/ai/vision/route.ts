import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { ENV } from '@/config/env';
import { UNITS_PER_VISION } from '@/config/aiUsageQuotas';
import { consumeAiUnitsOr429 } from '@/lib/quotas/tenantAiUnitsQuota';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase-server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

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

        const { data: membership } = await supabase
            .from('user_tenant_roles')
            .select('tenant_id')
            .eq('user_id', user.id)
            .eq('tenant_id', tenantId)
            .maybeSingle();

        if (!membership?.tenant_id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const admin = createSupabaseAdminClient();
        const { data: tenantRow } = await admin
            .from('tenants')
            .select('subscription_plan')
            .eq('id', tenantId)
            .maybeSingle();
        const plan = (tenantRow?.subscription_plan as string) || 'free';

        const usesRemoteAi = Boolean(ENV.OPENAI_API_KEY || ENV.ANTHROPIC_API_KEY);
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

        // 2. Determine which AI provider to use
        // Prioritize OpenAI for Vision (GPT-4o), fallback to Claude
        let extractedData = null;
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

        if (ENV.OPENAI_API_KEY) {
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
            // Clean markdown if present
            const cleanJson = content.replace(/```json\n?|\n?```/g, '');
            extractedData = JSON.parse(cleanJson);

        } else if (ENV.ANTHROPIC_API_KEY) {
            const anthropic = new Anthropic({ apiKey: ENV.ANTHROPIC_API_KEY });

            const response = await anthropic.messages.create({
                model: 'claude-sonnet-4-5-20250929',
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
        } else {
            // No AI provider configured - return basic file info for manual entry
            console.warn('No Vision-capable AI provider configured. Returning basic file info.');
            extractedData = {
                date: new Date().toISOString().split('T')[0],
                description: '',
                amount: 0,
                currency: 'USD',
                category: 'Uncategorized',
                confidence: 0
            };
        }

        if (!extractedData) {
             // Fallback for extraction failure
             extractedData = {
                date: new Date().toISOString().split('T')[0],
                description: '',
                amount: 0,
                currency: 'USD',
                category: 'Uncategorized',
                confidence: 0
            };
        }

        // 3. Upload File to Storage for records (optional but good practice)
        const fileExt = file.name.split('.').pop();
        const fileName = `receipt-${Date.now()}.${fileExt}`;
        const filePath = `${tenantId}/receipts/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('documents')
            .upload(filePath, file, { contentType: mimeType, upsert: true });

        let fileUrl = null;
        if (!uploadError && uploadData) {
            // Use proxied URL instead of direct Supabase URL
            fileUrl = `/api/storage/documents/${filePath}`;
        }

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
