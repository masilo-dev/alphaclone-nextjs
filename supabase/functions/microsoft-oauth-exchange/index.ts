const headers = {
  'Access-Control-Allow-Origin': 'https://alphaclonesystems.com',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

Deno.serve((request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  return new Response(JSON.stringify({
    error: 'This OAuth exchange endpoint is retired. Use /api/auth/microsoft/connect.',
  }), { status: 410, headers });
});
