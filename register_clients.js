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
<<<<<<< HEAD
    // Claude Desktop (numeric client_id is what Claude.ai actually sends)
    { 
        client_id: '1778309945386-41bab8272f61', 
        client_name: 'Claude Desktop (Anthropic)', 
        redirect_uris: [
            'https://claude.ai/api/mcp/auth_callback',
            'https://claude.ai/settings/oauth-callback',
            'https://api.claude.ai/v1/oauth/callback',
            'https://claude.ai/api/oauth/callback'
        ], 
        is_public: true,
        scopes: ['read', 'write', 'mcp:tools', 'mcp:resources', 'openid', 'profile']
    },
    // Legacy CLAUDE client (for backward compatibility)
    { 
        client_id: 'CLAUDE', 
        client_name: 'Claude AI (Legacy)', 
        redirect_uris: [
            'https://claude.ai/api/mcp/auth_callback',
            'https://claude.ai/api/oauth/callback',
            'https://claude.ai/auth/callback'
        ], 
        is_public: true,
        scopes: ['read', 'write', 'mcp:tools', 'mcp:resources']
    },
    // Claude Web client
    { 
        client_id: 'claude-web', 
        client_name: 'Claude Web (Anthropic)', 
        redirect_uris: [
            'https://claude.ai/api/mcp/auth_callback',
            'https://claude.ai/api/oauth/callback',
            'https://www.claude.ai/api/mcp/auth_callback'
        ], 
        is_public: true,
        scopes: ['read', 'write', 'mcp:tools', 'mcp:resources', 'openid', 'profile']
    },
    // Grok/X.AI clients
    { 
        client_id: 'GROK', 
        client_name: 'Grok AI', 
        redirect_uris: ['https://grok.com/auth/callback', 'https://x.ai/auth/callback'], 
        is_public: true,
        scopes: ['read', 'write', 'mcp:tools', 'mcp:resources']
    },
    { 
        client_id: 'grok-connector', 
        client_name: 'Grok Connector', 
        redirect_uris: ['https://grok.com/auth/callback', 'https://x.ai/auth/callback'], 
        is_public: true,
        scopes: ['read', 'write', 'mcp:tools', 'mcp:resources']
    },
    // ChatGPT client
    { 
        client_id: 'chatgpt-connector', 
        client_name: 'ChatGPT', 
        redirect_uris: [
            'https://chatgpt.com/connector_platform_oauth_redirect', 
            'https://chatgpt.com/connector/oauth/*',
            'https://chatgpt.com/connector/oauth/callback',
            'https://chat.openai.com/connector_platform_oauth_redirect', 
            'https://chat.openai.com/connector/oauth/*',
            'https://chat.openai.com/connector/oauth/callback',
            'https://platform.openai.com/apps-manage/oauth/*'
        ], 
        is_public: true,
        scopes: ['read', 'write', 'mcp:tools', 'mcp:resources']
    }
=======
    { client_id: 'CLAUDE', client_name: 'Claude AI', redirect_uris: ['https://claude.ai/api/mcp/auth_callback'], is_public: true },
    { client_id: 'GROK', client_name: 'Grok AI', redirect_uris: ['https://grok.com/auth/callback', 'https://x.ai/auth/callback'], is_public: true },
    { client_id: 'grok-connector', client_name: 'Grok Connector', redirect_uris: ['https://grok.com/auth/callback', 'https://x.ai/auth/callback'], is_public: true }
>>>>>>> origin/main
];

supabase.from('mcp_oauth_clients').upsert(clients).then(r => {
    if (r.error) {
        console.error('Error:', r.error);
    } else {
        console.log('Successfully registered AI clients');
    }
});
