import { NextRequest, NextResponse } from 'next/server';
import { zohoServerService } from '@/services/server/zohoServerService';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { rateLimitMiddleware, rateLimitConfigs } from '@/lib/rateLimit';

export async function GET(req: NextRequest) {
    // Apply rate limiting
    const rateLimitRes = await rateLimitMiddleware(req, rateLimitConfigs.api.zoho);
    if (rateLimitRes) return rateLimitRes;

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    try {
        // Check if integration exists in DB first
        const supabaseAdmin = createSupabaseAdminClient();
        const { data: integration, error: dbError } = await supabaseAdmin
            .from('integrations')
            .select('id, config')
            .eq('user_id', userId)
            .eq('type', 'zoho')
            .maybeSingle();

        if (dbError) {
            console.error('[Zoho Accounts] Database error:', dbError);
        }

        if (!integration) {
            return NextResponse.json({ 
                error: 'Zoho account not connected.',
                code: 'INTEGRATION_NOT_FOUND'
            }, { status: 404 });
        }

        // Now fetch details from Zoho API
        const accountsData = await zohoServerService.proxyRequest(userId, 'accounts');
        
        if (!accountsData.data || accountsData.data.length === 0) {
            return NextResponse.json({ 
                error: 'No Zoho accounts found.' 
            }, { status: 404 });
        }

        const accountId = accountsData.data[0].accountId;
        
        const extractEmailString = (val: any) => {
            if (!val) return null;
            if (typeof val === 'string') return val;
            return val.mailId || val.address || val.emailAddress || null;
        };

        const accountEmail = extractEmailString(accountsData.data[0].emailAddress) || 
                            extractEmailString(accountsData.data[0].primaryEmail) || 
                            '';
        
        // Update the integration config
        const updatedConfig = {
            ...(integration.config || {}),
            accountId,
            email: accountEmail,
            zoid: accountId
        };

        await supabaseAdmin
            .from('integrations')
            .update({ 
                config: updatedConfig,
                enabled: true,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('type', 'zoho');

        // Fetch verified from-addresses
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
                fromAddresses: fromAddresses
            }
        });
    } catch (error: any) {
        console.error('Error fetching Zoho account info:', error);
        return NextResponse.json({ 
            error: error.message || 'Failed to fetch Zoho account information' 
        }, { status: error.status || 500 });
    }
}
