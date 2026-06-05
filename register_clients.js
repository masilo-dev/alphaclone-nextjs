const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
const url = envContent.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();

if (!url || !key) {
    console.error('Missing URL or Key');
    process.exit(1);
}

const supabase = createClient(url, key);
const clients = [
    { client_id: 'CLAUDE', client_name: 'Claude AI', redirect_uris: ['https://claude.ai/api/mcp/auth_callback'], is_public: true },
    { client_id: 'GROK', client_name: 'Grok AI', redirect_uris: ['https://grok.com/auth/callback', 'https://x.ai/auth/callback'], is_public: true },
    { client_id: 'grok-connector', client_name: 'Grok Connector', redirect_uris: ['https://grok.com/auth/callback', 'https://x.ai/auth/callback'], is_public: true },
    { client_id: 'chatgpt-connector', client_name: 'ChatGPT', redirect_uris: ['https://chatgpt.com/connector_platform_oauth_redirect', 'https://chatgpt.com/connector/oauth/*', 'https://chat.openai.com/connector_platform_oauth_redirect', 'https://chat.openai.com/connector/oauth/*'], is_public: true }
];

supabase.from('mcp_oauth_clients').upsert(clients).then(r => {
    if (r.error) {
        console.error('Error:', r.error);
    } else {
        console.log('Successfully registered AI clients');
    }
});
