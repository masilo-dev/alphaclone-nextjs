
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.production.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkTokens() {
    console.log('Checking recent expired tokens...');
    const now = new Date().toISOString();
    
    const { data: tokens, error } = await supabase
        .from('mcp_oauth_tokens')
        .select('access_token, expires_at, tenant_id')
        .lt('expires_at', now)
        .order('expires_at', { ascending: false })
        .limit(10);
        
    if (error) {
        console.error('Error fetching tokens:', error);
        return;
    }
    
    if (!tokens || tokens.length === 0) {
        console.log('No expired tokens found.');
        return;
    }
    
    console.log('Recent expired tokens:');
    tokens.forEach(t => {
        const diff = (new Date() - new Date(t.expires_at)) / 1000 / 60;
        console.log(`- Token: ${t.access_token.substring(0, 15)}... Expired at: ${t.expires_at} (${diff.toFixed(2)} mins ago)`);
    });
}

checkTokens();
