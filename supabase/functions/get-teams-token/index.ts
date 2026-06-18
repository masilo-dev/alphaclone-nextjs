import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
    try {
        const { displayName } = await req.json();

        // Get Microsoft Graph token using client credentials flow
        const tenantId = Deno.env.get('AZURE_TENANT_ID');
        const clientId = Deno.env.get('AZURE_CLIENT_ID');
        const clientSecret = Deno.env.get('AZURE_CLIENT_SECRET');

        if (!tenantId || !clientId || !clientSecret) {
            return new Response(
                JSON.stringify({
                    available: false,
                    error: 'Azure credentials not configured',
                }),
                { headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Get access token for Microsoft Graph
        const tokenResponse = await fetch(
            `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    scope: 'https://graph.microsoft.com/.default',
                    grant_type: 'client_credentials',
                }),
            }
        );

        const tokenData = await tokenResponse.json();

        if (!tokenData.access_token) {
            return new Response(
                JSON.stringify({
                    available: false,
                    error: 'Failed to obtain Microsoft Graph token',
                }),
                { headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({
                available: true,
                token: tokenData.access_token,
            }),
            { headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({
                available: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }),
            { headers: { 'Content-Type': 'application/json' } }
        );
    }
});
