import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { ENV } from '@/config/env';

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

        // 1. Convert File to Base64
        const buffer = await file.arrayBuffer();
        const base64Data = Buffer.from(buffer).toString('base64');
        const mimeType = file.type;

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
                model: 'claude-3-5-sonnet-20241022',
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
            return NextResponse.json({ error: 'No Vision-capable AI provider configured. Please add OpenAI or Anthropic API Keys.' }, { status: 500 });
        }

        if (!extractedData || typeof extractedData.amount !== 'number' || !extractedData.description) {
            return NextResponse.json({ error: 'Failed to extract valid data from the receipt.', rawData: extractedData }, { status: 400 });
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
            const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
            fileUrl = data.publicUrl;
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
        return NextResponse.json({
            error: 'Failed to process receipt',
            details: error.message
        }, { status: 500 });
    }
}
