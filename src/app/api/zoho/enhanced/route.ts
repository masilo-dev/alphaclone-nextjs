import { NextRequest, NextResponse } from 'next/server';
import { zohoServerService } from '@/services/server/zohoServerService';

/**
 * Enhanced Zoho API handler that properly handles multi-tenant scenarios
 * Addresses the "Invalid Input" errors by:
 * 1. Fetching the correct account ID for each user
 * 2. Ensuring proper fromAddress configuration
 * 3. Handling multi-tenant authentication properly
 */

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const action = searchParams.get('action') || 'get_account_info';

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        switch (action) {
            case 'get_account_info':
                return await getAccountInfo(userId);
            case 'get_messages':
                return await getEmails(userId, searchParams);
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (err: any) {
        console.error(`Zoho API Error (${action}):`, err);
        return NextResponse.json({ 
            error: err.message || 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        }, { status: err.status || 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { userId, action, data } = await req.json();

        if (!userId || !action) {
            return NextResponse.json({ 
                error: 'Missing required fields: userId and action are required' 
            }, { status: 400 });
        }

        switch (action) {
            case 'send_email':
                return await sendEmail(userId, data);
            case 'delete_message':
                return await deleteMessage(userId, data);
            case 'move_to_folder':
                return await moveMessages(userId, data);
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (err: any) {
        console.error('Zoho API POST Error:', err);
        return NextResponse.json({ 
            error: err.message || 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        }, { status: err.status || 500 });
    }
}

/**
 * Get Zoho account information for the user
 * This is crucial for multi-tenant support
 */
async function getAccountInfo(userId: string) {
    try {
        // Check if integration exists in DB first
        const { createSupabaseAdminClient } = await import('@/lib/supabase-server');
        const supabaseAdmin = createSupabaseAdminClient();
        const { data: integration, error: dbError } = await supabaseAdmin
            .from('integrations')
            .select('id')
            .eq('user_id', userId)
            .eq('type', 'zoho')
            .maybeSingle();

        if (dbError) {
            console.error('[Zoho Debug] Database error checking integration:', dbError);
        }

        if (!integration) {
            console.warn(`[Zoho Debug] No integration record found in DB for user ${userId}. This is expected if the account is not yet connected. returning 404.`);
            return NextResponse.json({ 
                error: 'Zoho account not connected. Please go to Settings to connect your account.',
                code: 'INTEGRATION_NOT_FOUND'
            }, { status: 404 });
        }

        // Now fetch details from Zoho API
        const accountsData = await zohoServerService.proxyRequest(userId, 'accounts');
        
        if (!accountsData.data || accountsData.data.length === 0) {
            return NextResponse.json({ 
                error: 'No Zoho accounts found for this user. Please ensure your Zoho integration is properly configured.' 
            }, { status: 404 });
        }

        // Store the account ID in the user's integration config for future use
        const accountId = accountsData.data[0].accountId;
        
        // Helper to extract email string from potential object response
        const extractEmailString = (val: any) => {
            if (!val) return null;
            if (typeof val === 'string') return val;
            return val.mailId || val.address || val.emailAddress || null;
        };

        const accountEmail = extractEmailString(accountsData.data[0].emailAddress) || 
                            extractEmailString(accountsData.data[0].primaryEmail) || 
                            '';
        
        // Update the integration config with the account ID and email
        await updateIntegrationConfig(userId, {
            accountId,
            email: accountEmail,
            zoid: accountId // Also store as zoid for compatibility
        });

        // Fetch verified from-addresses for this account
        let fromAddresses: any[] = [];
        try {
            let sendAddressesData;
            try {
                sendAddressesData = await zohoServerService.proxyRequest(userId, 'sendmailaddresses');
            } catch (v1Error: any) {
                if (v1Error.status === 404) {
                    console.log('[Zoho Debug] V1 sendmailaddresses failed with 404, trying V2...');
                    sendAddressesData = await zohoServerService.proxyRequest(userId, 'v2/sendmailaddresses');
                } else {
                    throw v1Error;
                }
            }
            
            if (sendAddressesData?.data) {
                fromAddresses = sendAddressesData.data.map((addr: any) => {
                    const address = addr.sendAddress || addr.fromAddress || addr.address || addr.emailAddress || '';
                    return {
                        address: address,
                        isDefault: addr.isDefault,
                        displayName: addr.displayName
                    };
                });
            }
        } catch (e) {
            console.warn('[Zoho Debug] Could not fetch send-addresses:', e);
            // Fallback to the primary email if send-addresses call fails
            fromAddresses = [{ address: accountEmail, isDefault: true, displayName: accountsData.data[0].displayName }];
        }

        return NextResponse.json({
            success: true,
            data: {
                accountId,
                email: accountEmail,
                displayName: accountsData.data[0].displayName,
                accounts: accountsData.data,
                fromAddresses: fromAddresses
            }
        });
    } catch (error: any) {
        console.error('Error fetching Zoho account info:', error);
        return NextResponse.json({ 
            error: `Failed to fetch Zoho account information: ${error.message}` 
        }, { status: error.status || 500 });
    }
}

/**
 * Send email via Zoho Mail with proper multi-tenant support
 */
async function sendEmail(userId: string, emailData: any) {
    try {
        // Validate email data first
        if (!emailData.to || !emailData.subject || !emailData.content) {
            return NextResponse.json({ 
                error: 'Missing required email fields: to, subject, and content are required' 
            }, { status: 400 });
        }

        // Ensure to is in the correct format
        let toAddress = emailData.to;
        if (Array.isArray(toAddress)) {
            toAddress = toAddress.map((addr: any) => typeof addr === 'string' ? addr : addr.email).join(', ');
        } else if (typeof toAddress === 'object' && toAddress.email) {
            toAddress = toAddress.email;
        }

        // Resolve fromAddress: use provided one, or fetch from Zoho account info
        let fromAddress = emailData.fromAddress;
        if (!fromAddress) {
            try {
                const accountInfoRes = await getAccountInfo(userId);
                if (accountInfoRes.ok) {
                    const accountData = await accountInfoRes.json();
                    fromAddress = accountData.data?.fromAddresses?.find((a: any) => a.isDefault)?.address 
                        || accountData.data?.email;
                }
            } catch (e) {
                console.warn('[Zoho Send] Could not auto-resolve fromAddress:', e);
            }
        }

        if (!fromAddress) {
            return NextResponse.json({ 
                error: 'Could not determine sender email address. Please ensure Zoho is properly connected.' 
            }, { status: 400 });
        }

        const response = await zohoServerService.sendMessage(userId, {
            toAddress,
            subject: emailData.subject,
            content: emailData.content,
            fromAddress // Pass it directly so sendMessage doesn't need to re-fetch
        });

        return NextResponse.json({ success: true, data: response });
    } catch (error: any) {
        console.error('Error sending Zoho email:', error);
        return NextResponse.json({ 
            error: `Failed to send email: ${error.message}` 
        }, { status: error.status || 500 });
    }
}

/**
 * Get emails from Zoho Mail
 */
async function getEmails(userId: string, searchParams: URLSearchParams) {
    try {
        const folderId = searchParams.get('folderId') || searchParams.get('folder') || 'inbox';
        const messageId = searchParams.get('messageId');

        if (messageId) {
            const endpoint = `messages/${messageId}/details`;
            const data = await zohoServerService.proxyRequest(userId, endpoint);
            return NextResponse.json({
                success: true,
                data: data.data || {}
            });
        }

        // Map UI folder names to Zoho boolean folder properties
        const folderPropMap: { [key: string]: string } = {
            'inbox': 'isInbox',
            'sent': 'isSent',
            'drafts': 'isDraft',
            'trash': 'isTrash',
            'spam': 'isSpam'
        };

        // Hardcoded fallbacks for standard folders if resolution fails
        const folderFallbackMap: { [key: string]: number } = {
            'inbox': 7,
            'sent': 5,
            'drafts': 3,
            'trash': 4,
            'spam': 6
        };

        let actualFolderId: string | number = folderId;
        const lcFolder = folderId.toLowerCase();
        const isNamedFolder = Object.keys(folderPropMap).includes(lcFolder) || lcFolder === 'starred';
        
        // If it's a generic name like 'inbox', try to resolve to a numeric folderId from Zoho
        if (isNamedFolder) {
            try {
                const foldersData = await zohoServerService.proxyRequest(userId, 'folders');
                if (foldersData?.data && Array.isArray(foldersData.data)) {
                    const targetProp = folderPropMap[lcFolder];
                    
                    // Use permissive truthy check — Zoho may return true, "true", 1, or "1"
                    const targetFolder = foldersData.data.find((f: any) => 
                        (targetProp && f[targetProp]) || 
                        f.folderName?.toLowerCase() === lcFolder
                    );
                    
                    if (targetFolder?.folderId) {
                        actualFolderId = targetFolder.folderId;
                        console.log(`[Zoho Debug] Resolved '${folderId}' to folderId: ${actualFolderId}`);
                    } else {
                        // Fallback to hardcoded ID if resolution failed
                        if (folderFallbackMap[lcFolder]) {
                            actualFolderId = folderFallbackMap[lcFolder];
                            console.log(`[Zoho Debug] Resolution failed for '${folderId}', using fallback: ${actualFolderId}`);
                        } else {
                            console.warn(`[Zoho Debug] Could not resolve folder '${folderId}'. Available:`, 
                                foldersData.data.map((f: any) => `${f.folderName}(${f.folderId})`).join(', '));
                        }
                    }
                } else if (folderFallbackMap[lcFolder]) {
                    actualFolderId = folderFallbackMap[lcFolder];
                    console.log(`[Zoho Debug] Folders API empty or invalid, using fallback for '${folderId}': ${actualFolderId}`);
                }
            } catch (e: any) {
                // If folders fetch fails, use fallback if available
                if (folderFallbackMap[lcFolder]) {
                    actualFolderId = folderFallbackMap[lcFolder];
                    console.log(`[Zoho Debug] Folders API failed, using fallback for '${folderId}': ${actualFolderId}`);
                } else {
                    console.warn(`[Zoho Debug] Folders API failed and no fallback for '${folderId}':`, e?.message);
                }
            }
        }

        let queryParams = `sortBy=date&order=desc&start=0&limit=50`;
        
        if (lcFolder === 'starred') {
            queryParams += `&flagid=2`;
        } else {
            queryParams += `&folderId=${actualFolderId}`;
        }

        const endpoint = `messages/view?${queryParams}`;
        const data = await zohoServerService.proxyRequest(userId, endpoint);
        
        return NextResponse.json({
            success: true,
            data: data.data || []
        });
    } catch (error: any) {
        console.error('Error fetching Zoho emails:', error);
        return NextResponse.json({ 
            error: `Failed to fetch emails: ${error.message}` 
        }, { status: error.status || 500 });
    }
}

/**
 * Delete a message
 */
async function deleteMessage(userId: string, data: any) {
    const { messageId } = data;
    if (!messageId) throw new Error('messageId is required for deletion');
    
    const result = await zohoServerService.deleteMessage(userId, messageId);
    return NextResponse.json({ success: true, data: result });
}

/**
 * Move messages to folder
 */
async function moveMessages(userId: string, data: any) {
    const { messageIds, targetFolderId } = data;
    if (!messageIds || !targetFolderId) throw new Error('messageIds and targetFolderId are required');
    
    // Resolve folder name to ID if needed
    const folderMap: { [key: string]: string } = {
        'inbox': 'inbox',
        'sent': 'sent',
        'drafts': 'drafts',
        'trash': 'trash',
        'spam': 'spam'
    };
    const resolvedFolderId = folderMap[targetFolderId.toLowerCase()] || targetFolderId;
    
    const result = await zohoServerService.moveMessages(userId, Array.isArray(messageIds) ? messageIds : [messageIds], resolvedFolderId);
    return NextResponse.json({ success: true, data: result });
}

/**
 * Update user integration configuration with account information
 */
async function updateIntegrationConfig(userId: string, config: any) {
    try {
        const { createSupabaseAdminClient } = await import('@/lib/supabase-server');
        const supabaseAdmin = createSupabaseAdminClient();
        
        // Get current integration
        const { data: integration, error } = await supabaseAdmin
            .from('integrations')
            .select('config')
            .eq('user_id', userId)
            .eq('type', 'zoho')
            .single();

        if (error) {
            console.error('Error fetching integration:', error);
            return;
        }

        // Merge new config with existing config
        const updatedConfig = {
            ...(integration?.config || {}),
            ...config
        };

        console.log('[Zoho Debug] Updating config for user:', userId, 'with keys:', Object.keys(config));

        // Update the integration
        const { error: updateError } = await supabaseAdmin
            .from('integrations')
            .update({ 
                config: updatedConfig,
                enabled: true,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('type', 'zoho');

        if (updateError) throw updateError;

        console.log('Successfully updated Zoho integration config for user:', userId);
    } catch (error) {
        console.error('Error updating integration config:', error);
    }
}