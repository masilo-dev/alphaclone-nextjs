import { NextResponse } from 'next/server';
import unifiedAIService from '@/services/unifiedAIService';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET() {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const status = {
        config: {
            providers: unifiedAIService.getAvailableProviders()
        },
        tests: {
            unifiedService: null as any
        },
    };

    // Test: Unified AI Service (Claude/OpenAI)
    try {
        const start = Date.now();
        const res = await unifiedAIService.generateText("Say 'AlphaClone AI OK'", 10);
        status.tests.unifiedService = {
            success: !res.error && (res.text?.toLowerCase().includes('ok') || res.text?.toLowerCase().includes('alphaclone')),
            result: res.text,
            error: res.error,
            latency: Date.now() - start
        };
    } catch (e: any) {
        status.tests.unifiedService = { success: false, error: e.message };
    }

    return NextResponse.json(status);
}
