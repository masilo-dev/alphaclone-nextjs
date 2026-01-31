
const { createClient } = require('@supabase/supabase-js');

// Load env vars - simple hack for script since we can't use process.env directly if not loaded
// In a real verification script we might want to read .env.local, but since we are agent, 
// we will assume the agent environment has access or we fetch credentials? 
// Wait, the agent has 'mcp_supabase-mcp-server_execute_sql', but for a node script we need keys.
// ACTUALLY, I can just use the mcp tool to insert the record directly to simulate the "backend" write.
// BUT, the client-side code uses 'supabase.from("bookings").insert(...)'.
// To truly simulate what the client does, I need the Anon Key and URL.
// Let's grab them from the .env.local file first.

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function simulateBooking() {
    console.log('Starting booking simulation...');

    // 1. Get Tenant and Booking Type IDs (fetching known test data)
    const tenantSlug = 'test-tenant-verify';
    const serviceSlug = 'test-service';

    // We need to fetch the IDs first, just like the client does
    const { data: tenants, error: tErr } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .single();

    if (tErr || !tenants) {
        console.error('Tenant fetch failed:', tErr);
        return;
    }
    const tenantId = tenants.id;
    console.log('Found Tenant ID:', tenantId);

    const { data: services, error: sErr } = await supabase
        .from('booking_types')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('slug', serviceSlug)
        .single();

    if (sErr || !services) {
        console.error('Service fetch failed:', sErr);
        return;
    }
    const serviceId = services.id;
    console.log('Found Service ID:', serviceId);

    // 2. Prepare Booking Payload
    // Simulate a slot selection (e.g. tomorrow at 10am)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const endTime = new Date(tomorrow);
    endTime.setMinutes(endTime.getMinutes() + 30);

    const payload = {
        tenant_id: tenantId,
        booking_type_id: serviceId,
        client_name: 'Simulation User',
        client_email: 'simulation@alphaclone.tech',
        client_phone: '123-456-7890',
        client_notes: 'Automated simulation booking',
        start_time: tomorrow.toISOString(),
        end_time: endTime.toISOString(),
        status: 'confirmed',
        metadata: { source: 'simulation_script' }
    };

    console.log('Attempting Insert with payload:', payload);

    // 3. Insert Booking
    const { data, error } = await supabase
        .from('bookings')
        .insert(payload)
        .select();

    if (error) {
        console.error('Booking Insert FAILED:', error);
        process.exit(1);
    } else {
        console.log('Booking Insert SUCCESS:', data);
        console.log('Booking created with ID:', data[0].id);
    }
}

simulateBooking();
