import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/** POST /api/data-deletion — general GDPR/CCPA deletion request form */
export async function POST(req: NextRequest) {
    const supabase = createSupabaseAdminClient();

    try {
        const { email, name, reason } = await req.json();
        if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

        // Check for existing pending request
        const { data: existing } = await supabase
            .from('data_deletion_requests')
            .select('id, confirmation_code, status')
            .eq('requester_email', email)
            .in('status', ['pending', 'processing'])
            .maybeSingle();

        if (existing) {
            return NextResponse.json({
                success: true,
                confirmation_code: existing.confirmation_code,
                message: 'A deletion request for this email is already being processed.',
                already_exists: true,
            });
        }

        const { data: record, error } = await supabase
            .from('data_deletion_requests')
            .insert({
                requester_email: email,
                requester_name: name || null,
                reason: reason || null,
                source: 'gdpr_form',
                status: 'pending',
                request_type: 'full_deletion',
            })
            .select('confirmation_code')
            .single();

        if (error || !record) {
            return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            confirmation_code: record.confirmation_code,
            message: 'Your deletion request has been received. We will process it within 30 days.',
        });

    } catch (err) {
        console.error('Data deletion form error:', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/** GET /api/data-deletion?code=xxx — check request status */
export async function GET(req: NextRequest) {
    const supabase = createSupabaseAdminClient();
    const code = new URL(req.url).searchParams.get('code');
    if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });

    const { data, error } = await supabase
        .from('data_deletion_requests')
        .select('id, status, source, created_at, processed_at')
        .eq('confirmation_code', code)
        .single();

    if (error || !data) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    return NextResponse.json({ request: data });
}
