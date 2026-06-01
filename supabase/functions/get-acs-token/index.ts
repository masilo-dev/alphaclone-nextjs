// @ts-nocheck

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { displayName } = await request.json().catch(() => ({}));

    if (!Deno.env.get('ACS_CONNECTION_STRING')) {
      return Response.json(
        {
          available: false,
          error:
            'ACS_CONNECTION_STRING is not configured. Teams embedding is unavailable until Azure Communication Services credentials are added.',
          displayName: displayName || 'Guest',
        },
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return Response.json(
      {
        available: false,
        error:
          'ACS token issuance is not enabled in this environment yet. Add Azure Communication Services provisioning before enabling embedded Teams calls.',
        displayName: displayName || 'Guest',
      },
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return Response.json(
      {
        available: false,
        error: error instanceof Error ? error.message : 'Unexpected ACS token error',
      },
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
