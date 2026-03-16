import { NextRequest, NextResponse } from 'next/server';
import { zohoServerService } from '@/services/server/zohoServerService';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { rateLimitMiddleware, rateLimitConfigs } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    // Apply rate limiting
    const rateLimitRes = await rateLimitMiddleware(req, rateLimitConfigs.api.zoho);
    if (rateLimitRes) return rateLimitRes;

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { messageIds, targetFolderId } = await req.json();

        if (!messageIds || !targetFolderId) {
            return NextResponse.json({ 
                error: 'messageIds and targetFolderId are required' 
            }, { status: 400 });
        }

        // Map UI folder names to Zoho IDs if needed
        const folderMap: Record<string, string> = {
            'inbox': 'inbox',
            'sent': 'sent',
            'drafts': 'drafts',
            'trash': 'trash',
            'spam': 'spam'
        };
        const resolvedFolderId = folderMap[targetFolderId.toLowerCase()] || targetFolderId;

        const result = await zohoServerService.moveMessages(
            user.id, 
            Array.isArray(messageIds) ? messageIds : [messageIds], 
            resolvedFolderId
        );

        return NextResponse.json({ success: true, data: result });
    } catch (err: any) {
        console.error('Zoho Move Error:', err);
        return NextResponse.json({ 
            error: err.message || 'Internal server error'
        }, { status: err.status || 500 });
    }
}
