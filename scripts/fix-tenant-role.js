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

async function fixTenantRole() {
    const tenantEmail = 'bonnie.masilo@gmail.com';

    console.log(`\n🔧 Fixing role for ${tenantEmail}...\n`);

    try {
        // 1. Get user ID
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

        if (listError) {
            console.error('❌ Error listing users:', listError.message);
            return;
        }

        const user = users.find(u => u.email === tenantEmail);

        if (!user) {
            console.error(`❌ User ${tenantEmail} not found`);
            return;
        }

        console.log(`✓ Found user: ${user.id}`);
        console.log(`  Current metadata role: ${user.user_metadata?.role || 'none'}`);

        // 2. Update user metadata
        const { error: updateError } = await supabase.auth.admin.updateUserById(
            user.id,
            {
                user_metadata: {
                    ...user.user_metadata,
                    role: 'tenant_admin'
                }
            }
        );

        if (updateError) {
            console.error('❌ Error updating user metadata:', updateError.message);
            return;
        }

        console.log('✓ Updated user metadata to tenant_admin');

        // 3. Update profiles table
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ role: 'tenant_admin' })
            .eq('id', user.id);

        if (profileError) {
            console.error('❌ Error updating profile:', profileError.message);
            return;
        }

        console.log('✓ Updated profile role to tenant_admin');

        // 4. Verify the changes
        const { data: profile } = await supabase
            .from('profiles')
            .select('email, role')
            .eq('id', user.id)
            .single();

        const { data: { user: updatedUser } } = await supabase.auth.admin.getUserById(user.id);

        console.log('\n✅ Role update complete!');
        console.log('  Profile role:', profile?.role);
        console.log('  Metadata role:', updatedUser?.user_metadata?.role);

    } catch (err) {
        console.error('❌ Unexpected error:', err);
    }
}

fixTenantRole();
