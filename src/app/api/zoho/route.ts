import { NextRequest, NextResponse } from 'next/server';
import { zohoServerService } from '@/services/server/zohoServerService';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { rateLimitMiddleware, rateLimitConfigs } from '@/lib/rateLimit';
import { routeAIRequest } from '@/services/aiRouter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // Allow enough time for AI outreach generation

/**
 * Consolidated Zoho API handler
 * Handles all actions: account info, messages, sending, deleting, and AI outreach.
 * Resolves userId from session automatically.
 */

export async function GET(req: NextRequest) {
    // Apply rate limiting
    const rateLimitRes = await rateLimitMiddleware(req, rateLimitConfigs.api.zoho);
    if (rateLimitRes) return rateLimitRes;

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    if (!action) {
        return NextResponse.json({ error: 'Action parameter is required (e.g., action=get_account_info)' }, { status: 400 });
    }

    try {
        switch (action) {
            case 'get_account_info':
                return await getAccountInfo(userId);
            case 'get_messages':
                return await getMessages(userId, searchParams);
            case 'search_messages':
                return await searchMessages(userId, searchParams);
            default:
                return NextResponse.json({ error: `Invalid action "${action}". Specify action=get_account_info, action=get_messages, or action=search_messages` }, { status: 400 });
        }
    } catch (err: any) {
        console.error(`Zoho API GET Error (${action}):`, err);
        
        // If it's a known error from the service, it will have a .status
        const status = err.status || 500;
        
        return NextResponse.json({ 
            error: err.message || 'Internal server error',
            code: err.code || (status === 401 ? 'UNAUTHORIZED' : status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR'),
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        }, { status });
    }
}

export async function POST(req: NextRequest) {
    // Apply rate limiting
    const rateLimitRes = await rateLimitMiddleware(req, rateLimitConfigs.api.zoho);
    if (rateLimitRes) return rateLimitRes;

    try {
        const body = await req.json();
        const { action, data } = body;

        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = user.id;

        if (!action) {
            return NextResponse.json({ error: 'Missing action field' }, { status: 400 });
        }

        switch (action) {
            case 'send_email':
                return await sendEmail(userId, data);
            case 'reply_email':
                return await replyEmail(userId, data);
            case 'forward_email':
                return await forwardEmail(userId, data);
            case 'save_draft':
                return await saveDraft(userId, data);
            case 'update_message':
                return await updateMessage(userId, data);
            case 'delete_message':
                return await deleteMessage(userId, data);
            case 'move_to_folder':
                return await moveMessages(userId, data);
            case 'outreach':
                // For outreach, the entire body might be the outreach config or in 'data'
                // Adapting to match the existing outreach handler's expected structure
                return await handleOutreach(userId, data || body);
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (err: any) {
        console.error('Zoho API POST Error:', err);
        
        // If it's a known error from the service, it will have a .status
        const status = err.status || 500;
        
        return NextResponse.json({ 
            error: err.message || 'Internal server error',
            code: err.code || (status === 401 ? 'UNAUTHORIZED' : status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR'),
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        }, { status });
    }
}

/**
 * ACTIONS
 */

async function getAccountInfo(userId: string) {
    // Check if integration exists in DB first
    const supabaseAdmin = createSupabaseAdminClient();
    const { data: integration, error: dbError } = await supabaseAdmin
        .from('integrations')
        .select('id, config')
        .eq('user_id', userId)
        .eq('type', 'zoho')
        .maybeSingle();

    if (dbError) console.error('[Zoho API] DB Error:', dbError);
    if (!integration) {
        return NextResponse.json({ 
            error: 'Zoho account not connected.',
            code: 'INTEGRATION_NOT_FOUND'
        }, { status: 404 });
    }

    // Fetch details from Zoho
    const accountsData = await zohoServerService.proxyRequest(userId, 'accounts');
    if (!accountsData.data || accountsData.data.length === 0) {
        return NextResponse.json({ error: 'No Zoho accounts found.' }, { status: 404 });
    }

    const accountId = accountsData.data[0].accountId;
    const accountEmail = extractEmailString(accountsData.data[0].emailAddress) || 
                        extractEmailString(accountsData.data[0].primaryEmail) || 
                        '';

    // Update DB config with IDs
    await supabaseAdmin
        .from('integrations')
        .update({ 
            config: { ...(integration.config || {}), accountId, email: accountEmail, zoid: accountId },
            enabled: true,
            updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('type', 'zoho');

    // Fetch verified senders
    let fromAddresses: any[] = [];
    try {
        const sendAddressesData = await zohoServerService.proxyRequest(userId, 'sendmailaddresses');
        if (sendAddressesData?.data) {
            fromAddresses = sendAddressesData.data.map((addr: any) => ({
                address: addr.sendAddress || addr.fromAddress || addr.address || addr.emailAddress || '',
                isDefault: addr.isDefault,
                displayName: addr.displayName
            }));
        }
    } catch (e) {
        fromAddresses = [{ address: accountEmail, isDefault: true, displayName: accountsData.data[0].displayName }];
    }

    return NextResponse.json({
        success: true,
        data: {
            accountId,
            email: accountEmail,
            displayName: accountsData.data[0].displayName,
            accounts: accountsData.data,
            fromAddresses
        }
    });
}

async function getMessages(userId: string, searchParams: URLSearchParams) {
    const folderId = searchParams.get('folder') || searchParams.get('folderId') || 'inbox';
    const messageId = searchParams.get('messageId');

    if (messageId) {
        const data = await zohoServerService.proxyRequest(userId, `messages/${messageId}/details`);
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
            const foldersData = await zohoServerService.proxyRequest(userId, 'folders');
            // Support both data array and nested folders
            const folders = Array.isArray(foldersData?.data) ? foldersData.data : foldersData?.data?.folders || [];
            
            const targetFolder = folders.find((f: any) => 
                (folderPropMap[lcFolder] && f[folderPropMap[lcFolder]]) || 
                f.folderName?.toLowerCase() === lcFolder ||
                f.folderType?.toLowerCase() === lcFolder
            );
            actualFolderId = targetFolder?.folderId || folderFallbackMap[lcFolder] || folderId;
        } catch (e) {
            console.error('[Zoho API] Folder resolution failed:', e);
            actualFolderId = folderFallbackMap[lcFolder] || folderId;
        }
    }

    let queryParams = `start=1&limit=50&sortBy=date&order=desc`;
    if (lcFolder === 'starred') queryParams += `&flagid=2`;
    else queryParams += `&folderId=${actualFolderId}`;

    const data = await zohoServerService.proxyRequest(userId, `messages/view?${queryParams}`);
    
    // Normalize data for the UI
    const messages = (data.data || []).map((m: any) => ({
        ...m,
        id: m.messageId || m.id,
        date: m.receivedTime || m.sentDateInGMT || m.date,
        from: m.fromAddress || m.sender || m.from,
        to: m.toAddress || m.to,
        snippet: m.summary || m.snippet || ''
    }));

    return NextResponse.json({ success: true, data: messages });
}

async function sendEmail(userId: string, data: any) {
    const { to, subject, content, fromAddress } = data;
    if (!to || !subject || !content) {
        return NextResponse.json({ error: 'Missing required fields: to, subject, content' }, { status: 400 });
    }

    const response = await zohoServerService.sendMessage(userId, {
        toAddress: to, subject, content, fromAddress
    });

    return NextResponse.json({ success: true, data: response });
}

async function replyEmail(userId: string, data: any) {
    const { messageId, to, subject, content, fromAddress } = data;
    if (!messageId || !to || !subject || !content) {
        return NextResponse.json({ error: 'Missing required fields: messageId, to, subject, content' }, { status: 400 });
    }

    const response = await zohoServerService.replyMessage(userId, messageId, {
        toAddress: to, subject, content, fromAddress
    });

    return NextResponse.json({ success: true, data: response });
}

async function forwardEmail(userId: string, data: any) {
    const { messageId, to, subject, content, fromAddress } = data;
    if (!messageId || !to || !subject || !content) {
        return NextResponse.json({ error: 'Missing required fields: messageId, to, subject, content' }, { status: 400 });
    }

    const response = await zohoServerService.forwardMessage(userId, messageId, {
        toAddress: to, subject, content, fromAddress
    });

    return NextResponse.json({ success: true, data: response });
}

async function saveDraft(userId: string, data: any) {
    const { to, subject, content, fromAddress } = data;
    const response = await zohoServerService.saveDraft(userId, {
        toAddress: to || '', subject: subject || '(No Subject)', content: content || '', fromAddress
    });

    return NextResponse.json({ success: true, data: response });
}

async function updateMessage(userId: string, data: any) {
    const { messageId, mode, params } = data;
    if (!messageId || !mode) {
        return NextResponse.json({ error: 'Missing required fields: messageId, mode' }, { status: 400 });
    }

    const response = await zohoServerService.updateMessage(userId, messageId, mode, params || {});
    return NextResponse.json({ success: true, data: response });
}

async function deleteMessage(userId: string, data: any) {
    const { messageId } = data;
    if (!messageId) return NextResponse.json({ error: 'messageId is required' }, { status: 400 });
    
    const result = await zohoServerService.deleteMessage(userId, messageId);
    return NextResponse.json({ success: true, data: result });
}

async function moveMessages(userId: string, data: any) {
    const { messageIds, targetFolderId } = data;
    if (!messageIds || !targetFolderId) return NextResponse.json({ error: 'messageIds and targetFolderId required' }, { status: 400 });
    
    const result = await zohoServerService.moveMessages(userId, Array.isArray(messageIds) ? messageIds : [messageIds], targetFolderId);
    return NextResponse.json({ success: true, data: result });
}

async function handleOutreach(userId: string, outreachData: any) {
    const { leadIds, customPrompt, tone, fromAddress } = outreachData;

    if (!leadIds || !Array.isArray(leadIds)) {
        return NextResponse.json({ error: 'leadIds array is required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: leads, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .in('id', leadIds);

    if (leadError || !leads) throw new Error('Failed to fetch leads');

    const results = [];
    const businessContext = "AlphaClone Systems (AI & Automation Agency)";

    for (const lead of leads) {
        if (!lead.email) {
            results.push({ id: lead.id, name: lead.business_name, status: 'error', error: 'No email address' });
            continue;
        }

        try {
            const aiPrompt = `Write a personalized ${tone || 'professional'} outreach email.
Lead: ${lead.business_name} (${lead.industry}, ${lead.location})
Notes: ${lead.sdr_insight || lead.notes || 'N/A'}
Goal: ${customPrompt || 'Introduce our AI automation services.'}
Strict format:
Subject: [Subject]
[Body (max 150 words)]`;

            const aiResponse = await routeAIRequest({ prompt: aiPrompt, maxTokens: 600, temperature: 0.7 });
            if (!aiResponse.success || !aiResponse.content) throw new Error(aiResponse.error || 'AI generation failed');

            const rawContent = aiResponse.content.trim();
            const subjectLineMatch = rawContent.match(/^Subject:\s*(.*)/im);
            const subject = subjectLineMatch ? subjectLineMatch[1].trim() : `Strategic Partnership: ${lead.business_name}`;
            const body = rawContent.replace(/^Subject:.*\n?/im, '').trim();
            const htmlBody = body.replace(/\n/g, '<br/>');

            await zohoServerService.sendMessage(userId, {
                toAddress: lead.email,
                subject,
                content: htmlBody,
                fromAddress
            });

            await supabase.from('leads').update({
                outreach_status: 'sent',
                outreach_message: body,
                last_outreach_at: new Date().toISOString()
            }).eq('id', lead.id);

            results.push({ id: lead.id, name: lead.business_name, status: 'success' });
        } catch (err: any) {
            results.push({ id: lead.id, name: lead.business_name, status: 'error', error: err.message });
        }
    }

    return NextResponse.json({ success: true, processedCount: leads.length, results });
}

async function searchMessages(userId: string, searchParams: URLSearchParams) {
    const searchParam = searchParams.get('term') || searchParams.get('query') || '';
    if (!searchParam) {
        return NextResponse.json({ error: 'Search term is required' }, { status: 400 });
    }

    // Zoho V1 search endpoint
    const data = await zohoServerService.proxyRequest(userId, `messages/search?searchKey=${encodeURIComponent(searchParam)}&start=1&limit=50`);
    return NextResponse.json({ success: true, data: data.data || [] });
}

/**
 * HELPERS
 */

function extractEmailString(val: any) {
    if (!val) return null;
    if (typeof val === 'string') return val;
    return val.mailId || val.address || val.emailAddress || null;
}
