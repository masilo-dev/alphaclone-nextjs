
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.production.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function inspectSchema() {
    console.log('Inspecting deal_stage enum...');
    
    const { data, error } = await supabase.rpc('get_enum_values', { enum_name: 'deal_stage' });
    
    if (error) {
        // Fallback: try to query information_schema or just check a few records
        console.log('RPC failed, trying raw query via dashboard or guessing...');
        const { data: deals, error: dealsError } = await supabase.from('deals').select('stage').limit(10);
        if (dealsError) {
            console.error('Error fetching deals:', dealsError);
        } else {
            console.log('Existing deal stages:', [...new Set(deals.map(d => d.stage))]);
        }
    } else {
        console.log('Enum values:', data);
    }
}

inspectSchema();
