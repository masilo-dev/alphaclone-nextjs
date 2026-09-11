import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

function normalizeEmail(email: string | null | undefined): string {
    return String(email || '').trim().toLowerCase();
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const email = normalizeEmail(body?.email);

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();
        const { data, error } = await supabase
            .from('blocked_account_emails')
            .select('normalized_email')
            .eq('normalized_email', email)
            .maybeSingle();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            allowed: !data,
            blocked: !!data,
        });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}
