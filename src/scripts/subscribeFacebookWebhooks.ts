import { createSupabaseAdminClient } from '../lib/supabase-admin';
import { facebookService } from '../services/facebookService';

async function subscribeAllPages() {
    console.log('Starting Facebook Webhook subscription audit...');
    const supabase = createSupabaseAdminClient();

    // 1. Get all active Facebook integrations
    const { data: integrations, error } = await supabase
        .from('facebook_integrations')
        .select('tenant_id, page_id, page_name')
        .eq('is_active', true);

    if (error) {
        console.error('Error fetching integrations:', error);
        return;
    }

    if (!integrations || integrations.length === 0) {
        console.log('No active Facebook integrations found.');
        return;
    }

    console.log(`Found ${integrations.length} active integrations. Subscribing...`);

    for (const integration of integrations) {
        try {
            console.log(`Subscribing page: ${integration.page_name} (${integration.page_id})...`);
            await facebookService.subscribePage(integration.tenant_id, integration.page_id);
            console.log(`Successfully subscribed ${integration.page_name}`);
        } catch (err: any) {
            console.error(`Failed to subscribe ${integration.page_name}:`, err.message);
        }
    }

    console.log('Subscription audit complete.');
}

// Check if running directly
if (require.main === module) {
    subscribeAllPages().catch(console.error);
}

export { subscribeAllPages };
