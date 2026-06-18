import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { displayName } = await req.json();

        if (!displayName || typeof displayName !== 'string') {
            return new Response(
                JSON.stringify({
                    available: false,
                    error: 'displayName is required and must be a string',
                }),
                { 
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
                }
            );
        }

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
                { 
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
                }
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

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            return new Response(
                JSON.stringify({
                    available: false,
                    error: `Microsoft Graph token request failed: ${tokenResponse.status} ${errorText}`,
                }),
                { 
                    status: 502,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
                }
            );
        }

        const tokenData = await tokenResponse.json();

        if (!tokenData.access_token) {
            return new Response(
                JSON.stringify({
                    available: false,
                    error: 'Failed to obtain Microsoft Graph token - no access_token in response',
                }),
                { 
                    status: 502,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
                }
            );
        }

        return new Response(
            JSON.stringify({
                available: true,
                token: tokenData.access_token,
            }),
            { 
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({
                available: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }),
            { 
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
        );
    }
});
