import { NextResponse } from 'next/server';
import { geminiService } from '@/services/geminiService';
import unifiedAIService from '@/services/unifiedAIService';
import { ENV } from '@/config/env';

export async function GET() {
    const status = {
        config: {
            hasGeminiKey: !!ENV.VITE_GEMINI_API_KEY,
            keyPrefix: ENV.VITE_GEMINI_API_KEY ? ENV.VITE_GEMINI_API_KEY.substring(0, 4) + '...' : 'NONE',
            providers: unifiedAIService.getAvailableProviders()
        },
        tests: {
            geminiDirect: null as any,
            unifiedService: null as any
        },
        env_dump_keys: Object.keys(process.env).filter(k => k.includes('GEMINI') || k.includes('GOOGLE') || k.includes('AI') || k.includes('API_KEY'))
    };

    // Test 1: Direct Gemini Service
    try {
        if (ENV.VITE_GEMINI_API_KEY) {
            const start = Date.now();
            const res = await geminiService.generateContent("Say 'Gemini OK'");
            status.tests.geminiDirect = {
                success: !res.error && res.text?.includes('OK'),
                result: res.text,
                error: res.error,
                latency: Date.now() - start
            };
        } else {
            status.tests.geminiDirect = { skipped: true, reason: 'No API Key' };
        }
    } catch (e: any) {
        status.tests.geminiDirect = { success: false, error: e.message };
    }

    // Test 2: Unified AI Service
    try {
        const start = Date.now();
        const res = await unifiedAIService.generateText("Say 'Unified OK'", 10);
        status.tests.unifiedService = {
            success: !res.error && res.text?.includes('OK'),
            result: res.text,
            error: res.error,
            latency: Date.now() - start
        };
    } catch (e: any) {
        status.tests.unifiedService = { success: false, error: e.message };
    }

    return NextResponse.json(status);
}
