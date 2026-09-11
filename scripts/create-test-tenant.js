require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function createTestTenant() {
    const tenantEmail = 'bonnie.masilo@gmail.com';
    console.log(`\n🔧 Creating test tenant for ${tenantEmail}...\n`);

    try {
        // 1. Get user ID
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) return console.error('❌ Error listing users:', listError.message);

        const user = users.find(u => u.email === tenantEmail);
        if (!user) return console.error(`❌ User ${tenantEmail} not found`);

        console.log(`✓ Found user: ${user.id}`);

        // 2. Check if tenant already exists for this user
        const { data: existingTenants, error: tenantError } = await supabase
            .from('tenants')
            .select('*')
            .eq('admin_user_id', user.id);

        if (existingTenants && existingTenants.length > 0) {
            console.log('✓ Tenant already exists:', existingTenants[0].name);

            // Ensure tenant_users link exists
            const { data: links } = await supabase
                .from('tenant_users')
                .select('*')
                .eq('tenant_id', existingTenants[0].id)
                .eq('user_id', user.id);

            if (!links || links.length === 0) {
                console.log('  Creating missing tenant_users link...');
                await supabase.from('tenant_users').insert({
                    tenant_id: existingTenants[0].id,
                    user_id: user.id,
                    role: 'admin'
                });
                console.log('✓ Link created');
            }
            return;
        }

        // 3. Create new tenant
        const tenantName = "Bonnie's Organization";
        const tenantSlug = "bonnie-org";

        // Check if slug exists
        const { data: slugCheck } = await supabase.from('tenants').select('id').eq('slug', tenantSlug);
        const finalSlug = slugCheck.length > 0 ? `${tenantSlug}-${Date.now()}` : tenantSlug;

        const { data: newTenant, error: createError } = await supabase
            .from('tenants')
            .insert({
                name: tenantName,
                slug: finalSlug,
                admin_user_id: user.id,
                subscription_plan: 'free',
                // Add commonly required fields if any (adjust based on schema)
            })
            .select()
            .single();

        if (createError) {
            console.error('❌ Error creating tenant:', createError.message);
            return;
        }

        console.log('✓ Created new tenant:', newTenant.id);

        // 4. Create tenant_users link
        const { error: linkError } = await supabase
            .from('tenant_users')
            .insert({
                tenant_id: newTenant.id,
                user_id: user.id,
                role: 'admin'
            });

        if (linkError) {
            console.error('❌ Error linking user to tenant:', linkError.message);
        } else {
            console.log('✓ Linked user to tenant as admin');
        }

        console.log('\n✅ Test setup complete!');

    } catch (err) {
        console.error('❌ Unexpected error:', err);
    }
}

createTestTenant();
