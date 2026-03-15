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
        }, { status: 500 });
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

        // Ensure account info is available before proceeding
        const accountInfo = await getAccountInfo(userId);
        if (!accountInfo.ok) {
            return accountInfo;
        }

        const accountData = await accountInfo.json();
        if (!accountData.data?.accountId) {
            return NextResponse.json({ 
                error: 'Failed to retrieve Zoho account information. Please ensure your Zoho integration is properly configured.' 
            }, { status: 400 });
        }

        switch (action) {
            case 'send_email':
                return await sendEmail(userId, data);
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (err: any) {
        console.error('Zoho API POST Error:', err);
        return NextResponse.json({ 
            error: err.message || 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        }, { status: 500 });
    }
}

/**
 * Get Zoho account information for the user
 * This is crucial for multi-tenant support
 */
async function getAccountInfo(userId: string) {
    try {
        // First, get the account ID from Zoho
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
        let fromAddresses = [];
        try {
            const sendAddressesData = await zohoServerService.proxyRequest(userId, 'sendaddresses');
            if (sendAddressesData?.data) {
                fromAddresses = sendAddressesData.data.map((addr: any) => {
                    const address = extractEmailString(addr.sendAddress) || extractEmailString(addr.address) || '';
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
        }, { status: 500 });
    }
}

/**
 * Send email via Zoho Mail with proper multi-tenant support
 */
async function sendEmail(userId: string, emailData: any) {
    try {
        // Get account info to ensure we have the correct fromAddress
        const accountInfo = await getAccountInfo(userId);
        if (!accountInfo.ok) {
            return accountInfo;
        }

        const accountData = await accountInfo.json();
        const fromAddress = accountData.data.email;

        if (!fromAddress) {
            return NextResponse.json({ 
                error: 'Could not determine sender email address from Zoho account' 
            }, { status: 400 });
        }

        // Validate email data
        if (!emailData.to || !emailData.subject || !emailData.content) {
            return NextResponse.json({ 
                error: 'Missing required email fields: to, subject, and content are required' 
            }, { status: 400 });
        }

        // Ensure to is in the correct format
        let toAddress = emailData.to;
        if (Array.isArray(toAddress)) {
            toAddress = toAddress.map(addr => typeof addr === 'string' ? addr : addr.email).join(', ');
        } else if (typeof toAddress === 'object' && toAddress.email) {
            toAddress = toAddress.email;
        }

        const response = await zohoServerService.sendMessage(userId, {
            toAddress: toAddress,
            subject: emailData.subject,
            content: emailData.content,
            fromAddress: emailData.fromAddress || fromAddress
        });

        return NextResponse.json({
            success: true,
            data: response
        });
    } catch (error: any) {
        console.error('Error sending Zoho email:', error);
        return NextResponse.json({ 
            error: `Failed to send email: ${error.message}` 
        }, { status: 500 });
    }
}

/**
 * Get emails from Zoho Mail
 */
async function getEmails(userId: string, searchParams: URLSearchParams) {
    try {
        // Handle both 'folder' (common from frontend) and 'folderId' (Zoho's internal param)
        const folderId = searchParams.get('folderId') || searchParams.get('folder') || 'inbox';
        const messageId = searchParams.get('messageId');

        let endpoint: string;
        
        if (messageId) {
            endpoint = `messages/${messageId}/details`;
        } else {
            // Map folder names to Zoho folder IDs
            const folderMap: { [key: string]: string } = {
                'inbox': 'inbox',
                'sent': 'sent',
                'drafts': 'drafts',
                'trash': 'trash',
                'spam': 'spam'
            };
            
            const actualFolderId = folderMap[folderId.toLowerCase()] || folderId;
            endpoint = `messages/view?folderId=${actualFolderId}`;
            console.log(`[Zoho Debug] Fetching folder: ${actualFolderId} for user: ${userId}`);
        }

        const data = await zohoServerService.proxyRequest(userId, endpoint);
        
        // Ensure we handle the data structure correctly (Zoho usually returns { data: [...] })
        return NextResponse.json({
            success: true,
            data: data.data || []
        });
    } catch (error: any) {
        console.error('Error fetching Zoho emails:', error);
        return NextResponse.json({ 
            error: `Failed to fetch emails: ${error.message}` 
        }, { status: 500 });
    }
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