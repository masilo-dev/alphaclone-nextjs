
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
    console.log('Testing insert into oauth_states...');
    // Use a dummy user ID or one that exists
    const userId = 'df841125-59ce-4e09-aa2d-5b746ec03d9b';
    
    const { data, error } = await supabase
        .from('oauth_states')
        .insert({ user_id: userId })
        .select('id')
        .single();
    
    if (error) {
        console.error('Insert failed:', error);
    } else {
        console.log('Insert successful! State ID:', data.id);
        
        // Cleanup
        await supabase.from('oauth_states').delete().eq('id', data.id);
        console.log('Cleanup successful.');
    }
}

testInsert();
