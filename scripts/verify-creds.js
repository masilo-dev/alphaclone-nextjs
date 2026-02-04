
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testLogin() {
    console.log('Testing Super Admin Login...');
    const { data, error } = await supabase.auth.signInWithPassword({
        email: process.env.SUPER_ADMIN_EMAIL,
        password: process.env.SUPER_ADMIN_PASSWORD,
    });

    if (error) {
        console.error('Login Failed:', error.message);
    } else {
        console.log('Login Successful for:', data.user.email);
        console.log('User Role (from metadata):', data.user.user_metadata.role);
    }

    console.log('\nTesting Tenant Login...');
    const { data: tData, error: tError } = await supabase.auth.signInWithPassword({
        email: process.env.TENANT_EMAIL,
        password: process.env.TENANT_PASSWORD,
    });

    if (tError) {
        console.error('Login Failed:', tError.message);
    } else {
        console.log('Login Successful for:', tData.user.email);
    }

    console.log('\nTesting Client Login...');
    const { data: cData, error: cError } = await supabase.auth.signInWithPassword({
        email: process.env.CLIENT_EMAIL,
        password: process.env.CLIENT_PASSWORD,
    });

    if (cError) {
        console.error('Login Failed:', cError.message);
    } else {
        console.log('Login Successful for:', cData.user.email);
    }
}

testLogin();
