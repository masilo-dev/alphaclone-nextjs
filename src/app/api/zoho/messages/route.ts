import { NextRequest, NextResponse } from 'next/server';
import { zohoServerService } from '@/services/server/zohoServerService';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { rateLimitMiddleware, rateLimitConfigs } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const rateLimitRes = await rateLimitMiddleware(req, rateLimitConfigs.api.zoho);
    if (rateLimitRes) return rateLimitRes;

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get('folderId') || searchParams.get('folder') || 'inbox';
    const messageId = searchParams.get('messageId');

    try {
        if (messageId) {
            const data = await zohoServerService.proxyRequest(user.id, `messages/${messageId}/details`);
            return NextResponse.json({ success: true, data: data.data || {} });
        }

        const folderPropMap: Record<string, string> = {
            'inbox': 'isInbox', 'sent': 'isSent', 'drafts': 'isDraft', 'trash': 'isTrash', 'spam': 'isSpam'
        };
        const folderFallbackMap: Record<string, number> = {
            'inbox': 7, 'sent': 5, 'drafts': 3, 'trash': 4, 'spam': 6
        };

        let actualFolderId: string | number = folderId;
        const lcFolder = folderId.toLowerCase();
        
        if (folderPropMap[lcFolder] || lcFolder === 'starred') {
            try {
                const foldersData = await zohoServerService.proxyRequest(user.id, 'folders');
                const targetFolder = foldersData?.data?.find((f: any) => 
                    (folderPropMap[lcFolder] && f[folderPropMap[lcFolder]]) || f.folderName?.toLowerCase() === lcFolder
                );
                actualFolderId = targetFolder?.folderId || folderFallbackMap[lcFolder] || folderId;
            } catch (e) {
                actualFolderId = folderFallbackMap[lcFolder] || folderId;
            }
        }

        let queryParams = `sortBy=date&sortorder=desc&start=0&limit=50`;
        if (lcFolder === 'starred') queryParams += `&flagid=2`;
        else queryParams += `&folderId=${actualFolderId}`;

        const data = await zohoServerService.proxyRequest(user.id, `messages/view?${queryParams}`);
        return NextResponse.json({ success: true, data: data.data || [] });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: err.status || 500 });
    }
}

export async function POST(req: NextRequest) {
    const rateLimitRes = await rateLimitMiddleware(req, rateLimitConfigs.api.zoho);
    if (rateLimitRes) return rateLimitRes;

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { to, subject, content, fromAddress } = body;

        if (!to || !subject || !content) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const response = await zohoServerService.sendMessage(user.id, {
            toAddress: to, subject, content, fromAddress
        });

        return NextResponse.json({ success: true, data: response });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: err.status || 500 });
    }
}
