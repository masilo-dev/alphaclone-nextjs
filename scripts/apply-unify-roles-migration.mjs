import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.production.local' });

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function applyMigration() {
  console.log('=== Step 1: Upgrading profiles with role = "client" to "tenant_admin" ===');
  const { data: clientProfilesBefore, error: errBefore } = await supabase
    .from('profiles')
    .select('id, email, role, tenant_id')
    .eq('role', 'client');
  if (errBefore) throw errBefore;
  console.log(`Found ${clientProfilesBefore.length} profiles with role = 'client'.`);

  const { data: updatedProfiles, error: updateErr1 } = await supabase
    .from('profiles')
    .update({ role: 'tenant_admin' })
    .eq('role', 'client')
    .select('id, email, role');
  if (updateErr1) throw updateErr1;
  console.log(`Updated ${updatedProfiles.length} profiles to role = 'tenant_admin'.`);

  console.log('\n=== Step 2: Upgrading tenant_users with role = "client" to "tenant_admin" ===');
  const { data: clientTenantUsersBefore } = await supabase
    .from('tenant_users')
    .select('id, tenant_id, user_id, role')
    .eq('role', 'client');
  console.log(`Found ${(clientTenantUsersBefore || []).length} tenant_users with role = 'client'.`);

  const { data: updatedTenantUsers, error: updateErr2 } = await supabase
    .from('tenant_users')
    .update({ role: 'tenant_admin' })
    .eq('role', 'client')
    .select('id, tenant_id, user_id, role');
  if (updateErr2) throw updateErr2;
  console.log(`Updated ${(updatedTenantUsers || []).length} tenant_users to role = 'tenant_admin'.`);

  console.log('\n=== Step 3: Upgrading user_tenant_roles with role = "client" to "tenant_admin" ===');
  const { data: clientUtrBefore } = await supabase
    .from('user_tenant_roles')
    .select('tenant_id, user_id, role')
    .eq('role', 'client');
  console.log(`Found ${(clientUtrBefore || []).length} user_tenant_roles with role = 'client'.`);

  const { data: updatedUtr, error: updateErr3 } = await supabase
    .from('user_tenant_roles')
    .update({ role: 'tenant_admin' })
    .eq('role', 'client')
    .select('tenant_id, user_id, role');
  if (updateErr3) throw updateErr3;
  console.log(`Updated ${(updatedUtr || []).length} user_tenant_roles to role = 'tenant_admin'.`);

  console.log('\n=== Step 4: Synchronizing profiles.tenant_id from tenant_users ===');
  const { data: profilesMissingTenant } = await supabase
    .from('profiles')
    .select('id, email, tenant_id')
    .is('tenant_id', null);

  for (const prof of profilesMissingTenant || []) {
    const { data: tuRows } = await supabase
      .from('tenant_users')
      .select('tenant_id, joined_at')
      .eq('user_id', prof.id)
      .order('joined_at', { ascending: false })
      .limit(1);

    if (tuRows && tuRows.length > 0) {
      const targetTenantId = tuRows[0].tenant_id;
      const { error: syncErr } = await supabase
        .from('profiles')
        .update({ tenant_id: targetTenantId })
        .eq('id', prof.id);
      if (syncErr) {
        console.error(`Failed to link tenant ${targetTenantId} to profile ${prof.email}:`, syncErr);
      } else {
        console.log(`Linked existing tenant ${targetTenantId} to profile ${prof.email}`);
      }
    }
  }

  console.log('\n=== Step 5: Automatically provisioning workspaces for users with no workspace ===');
  const { data: remainingWithoutTenant } = await supabase
    .from('profiles')
    .select('id, name, email, tenant_id')
    .is('tenant_id', null);

  for (const user of remainingWithoutTenant || []) {
    const cleanName = (user.name || user.email?.split('@')[0] || 'User').trim();
    const orgName = `${cleanName}'s Organization`;
    const slugBase = `org-${user.id.slice(0, 8)}`;

    console.log(`Provisioning workspace for ${user.email} (${user.id})...`);
    const { data: newTenantId, error: rpcErr } = await supabase.rpc('create_tenant', {
      p_name: orgName,
      p_slug: slugBase,
      p_admin_user_id: user.id,
      p_plan: 'free'
    });

    if (rpcErr) {
      console.error(`create_tenant RPC failed for ${user.email}:`, rpcErr.message);
      // Fallback: direct insert into tenants and tenant_users if RPC restricted
      const { data: insertedTenant, error: insErr } = await supabase
        .from('tenants')
        .insert({
          name: orgName,
          slug: `${slugBase}-${Date.now().toString(36).slice(-4)}`,
          subscription_plan: 'free',
          subscription_status: 'trial',
          trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString()
        })
        .select('id')
        .single();

      if (insErr) {
        console.error(`Direct tenant insert failed for ${user.email}:`, insErr);
        continue;
      }

      await supabase.from('tenant_users').insert({
        tenant_id: insertedTenant.id,
        user_id: user.id,
        role: 'tenant_admin'
      });

      await supabase.from('profiles').update({ tenant_id: insertedTenant.id }).eq('id', user.id);
      console.log(`Successfully created fallback workspace ${insertedTenant.id} for ${user.email}`);
    } else {
      await supabase.from('profiles').update({ tenant_id: newTenantId }).eq('id', user.id);
      console.log(`Successfully created workspace ${newTenantId} via RPC for ${user.email}`);
    }
  }

  console.log('\n=== Step 6: Post-Migration Validation ===');
  const { data: checkProfiles } = await supabase.from('profiles').select('id').eq('role', 'client');
  const { data: checkTenantUsers } = await supabase.from('tenant_users').select('id').eq('role', 'client');
  const { data: checkUtr } = await supabase.from('user_tenant_roles').select('tenant_id').eq('role', 'client');
  const { data: checkNoTenant } = await supabase.from('profiles').select('id, email').is('tenant_id', null);

  console.log(`Profiles with role 'client': ${(checkProfiles || []).length} (expected: 0)`);
  console.log(`Tenant users with role 'client': ${(checkTenantUsers || []).length} (expected: 0)`);
  console.log(`User tenant roles with role 'client': ${(checkUtr || []).length} (expected: 0)`);
  console.log(`Profiles without tenant_id: ${(checkNoTenant || []).length} (expected: 0)`);

  const { data: kingRoar } = await supabase
    .from('profiles')
    .select('id, email, role, tenant_id')
    .eq('email', 'kingroar.bonnie@gmail.com')
    .single();
  console.log('\nKing Roar status after migration:', kingRoar);

  const { data: kingRoarTu } = await supabase
    .from('tenant_users')
    .select('tenant_id, role')
    .eq('user_id', kingRoar.id);
  console.log('King Roar tenant_users after migration:', kingRoarTu);
}

applyMigration()
  .then(() => {
    console.log('\nMigration completed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nMigration failed:', err);
    process.exit(1);
  });
