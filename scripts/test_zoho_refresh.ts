import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testZoho(userId: string) {
    console.log(`Testing Zoho for user: ${userId}`);

    const { data: integration, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'zoho')
        .maybeSingle();

    if (error || !integration) {
        console.error('Integration not found or error:', error);
        return;
    }

    const config = integration.config;
    console.log('Config found:', {
        mailApiHost: config.mailApiHost,
        accountId: config.accountId,
        accountsServer: config.accountsServer,
        hasRefreshToken: !!config.refreshToken
    });

    // Attempt to refresh token manually
    let accountsServer = config.accountsServer;
    const mailApiHost = config.mailApiHost || 'mail.zoho.com';

    if (!accountsServer) {
        if (mailApiHost.includes('.eu')) accountsServer = 'https://accounts.zoho.eu';
        else if (mailApiHost.includes('.in')) accountsServer = 'https://accounts.zoho.in';
        else if (mailApiHost.includes('.com.au')) accountsServer = 'https://accounts.zoho.com.au';
        else if (mailApiHost.includes('.jp')) accountsServer = 'https://accounts.zoho.jp';
        else if (mailApiHost.includes('.ca')) accountsServer = 'https://accounts.zoho.ca';
        else accountsServer = 'https://accounts.zoho.com';
    }

    console.log(`Using accountsServer: ${accountsServer}`);

    const refreshBody = new URLSearchParams({
        refresh_token: config.refreshToken,
        client_id: process.env.ZOHO_CLIENT_ID || '',
        client_secret: process.env.ZOHO_CLIENT_SECRET || '',
        grant_type: 'refresh_token',
    });

    try {
        const response = await fetch(`${accountsServer}/oauth/v2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: refreshBody,
        });

        const data = await response.json();
        console.log('Refresh Response:', data);

        if (data.access_token) {
            console.log('Successfully got new access token');

            // Try a simple API call
            const baseUrl = `https://${mailApiHost}/api/accounts`;
            const url = `${baseUrl}/${config.accountId}/folders`;
            console.log(`Testing folders API: ${url}`);

            const apiRes = await fetch(url, {
                headers: {
                    Authorization: `Zoho-oauthtoken ${data.access_token}`,
                    'Content-Type': 'application/json',
                },
            });

            console.log(`API Status: ${apiRes.status}`);
            const apiData = await apiRes.json();
            console.log('API Data:', JSON.stringify(apiData, null, 2));
        }
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

const targetUserId = 'df841125-59ce-4e09-aa2d-5b746ec03d9b';
testZoho(targetUserId);
