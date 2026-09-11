
import { createSupabaseAdminClient } from '../src/lib/supabase-admin';

async function testRpc() {
    const supabase = createSupabaseAdminClient();
    
    // Get a tenant ID to test with
    const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
    if (!tenants || tenants.length === 0) {
        console.error('No tenants found');
        return;
    }
    
    const tenantId = tenants[0].id;
    console.log(`Testing RPC for tenant: ${tenantId}`);
    
    const { data, error } = await supabase.rpc('get_consolidated_dashboard_stats', {
        p_tenant_id: tenantId
    });
    
    if (error) {
        console.error('RPC Error:', error);
    } else {
        console.log('RPC Success:', data);
    }
}

testRpc();
