import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('type', 'zoho');

    if (error) {
        console.error('Error fetching integrations:', error);
        return;
    }

    if (data.length === 0) {
        console.log('No Zoho integrations found.');
        return;
    }

    console.log(`Found ${data.length} Zoho integrations.`);
    for (const intg of data) {
        console.log(`\nUser: ${intg.user_id}`);
        console.log(`Config Keys: ${Object.keys(intg.config || {}).join(', ')}`);

        if (intg.config) {
            console.log(`Has Refresh Token: ${!!intg.config.refreshToken}`);
            if (intg.config.expiryDate) {
                const expiresAt = new Date(intg.config.expiryDate).getTime();
                const isExpired = Date.now() > expiresAt - 60000;
                console.log(`Is Expired: ${isExpired} (Expires: ${new Date(expiresAt).toLocaleString()})`);
            }
        }
    }
}

main();
