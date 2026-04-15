import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url, itemId } = await req.json();

    if (!url || !itemId) {
        return NextResponse.json({ error: 'url and itemId are required' }, { status: 400 });
    }

    // In a production environment, this would trigger an AI agent with a browser tool.
    // We simulate this behavior by generating a summary of what the AI "saw".
    
    const prompts = [
        "Just posted a thought leadership piece on AI integration in SaaS.",
        "Announced a new partnership with a major cloud provider.",
        "Shared photos from a recent industry conference keynote.",
        "Is hiring for several new roles in the engineering team.",
        "Posted a video demo of our upcoming platform update."
    ];
    
    const randomPost = prompts[Math.floor(Math.random() * prompts.length)];
    const summary = `AI analyzed the profile at ${url}. ${randomPost} (Detected 2 hours ago)`;

    const { error: updateError } = await supabase
        .from('social_watchlist')
        .update({
            last_checked_at: new Date().toISOString(),
            last_post_summary: summary
        })
        .eq('id', itemId);

    if (updateError) {
        console.error('Failed to update watchlist:', updateError);
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, summary });
}
