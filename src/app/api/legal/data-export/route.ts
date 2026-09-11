import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { ENV } from '@/config/env';

export const dynamic = 'force-dynamic';

async function resolveUser(req: NextRequest) {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Server configuration error.');
  }
  const admin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  if (bearer) {
    const { data, error } = await admin.auth.getUser(bearer);
    if (error || !data.user) throw new Error('Authentication required.');
    return { admin, user: data.user };
  }
  const { data, error } = await admin.auth.getUser();
  if (error || !data.user) throw new Error('Authentication required.');
  return { admin, user: data.user };
}

async function fetchRows<T = any>(query: PromiseLike<{ data: T[] | null; error: any }>) {
  const { data, error } = await query;
  if (error) return [];
  return data || [];
}

async function fetchUserInvoices(admin: { from: (table: string) => any }, user: { id: string; email?: string | null }) {
  const { data: clients } = user.email
    ? await admin.from('business_clients').select('id').eq('email', user.email)
    : { data: [] as { id: string }[] };
  const clientIds = (clients || []).map((client: { id: string }) => client.id);
  const filters = [`approved_by.eq.${user.id}`];
  if (user.email) filters.push(`client_email.eq.${user.email}`);
  if (clientIds.length) filters.push(`client_id.in.(${clientIds.join(',')})`);
  const { data, error } = await admin.from('business_invoices').select('*').or(filters.join(','));
  if (error) return [];
  return data || [];
}

export async function GET(req: NextRequest) {
  try {
    const { admin, user } = await resolveUser(req);
    const exportDate = format(new Date(), 'yyyy-MM-dd');

    const lastExport = await admin
      .from('data_requests')
      .select('id, created_at')
      .eq('user_id', user.id)
      .eq('request_type', 'export')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastExport.data?.created_at) {
      const diffMs = Date.now() - new Date(lastExport.data.created_at).getTime();
      if (diffMs < 24 * 60 * 60 * 1000) {
        return NextResponse.json({ error: 'Export is limited to one request per 24 hours.' }, { status: 429 });
      }
    }

    const [profile, contacts, invoices, contracts, emails, campaigns, activityLogs] = await Promise.all([
      admin.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      fetchRows(admin.from('contacts').select('*').eq('owner_id', user.id)),
      fetchUserInvoices(admin, user),
      fetchRows(admin.from('contracts').select('*').or(`created_by.eq.${user.id},owner_id.eq.${user.id},client_id.eq.${user.id}`)),
      fetchRows(admin.from('email_logs').select('*').or(`user_id.eq.${user.id},created_by.eq.${user.id},sender_id.eq.${user.id}`)),
      fetchRows(admin.from('campaigns').select('*').or(`user_id.eq.${user.id},created_by.eq.${user.id},owner_id.eq.${user.id}`)),
      fetchRows(admin.from('activity_logs').select('*').eq('user_id', user.id)),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
      },
      profile: profile.data || null,
      contacts,
      invoices,
      contracts,
      sentEmails: emails,
      campaigns,
      activityLog: activityLogs,
    };

    await admin.from('data_requests').insert({
      user_id: user.id,
      email: user.email,
      request_type: 'export',
      details: 'GDPR export requested',
      status: 'completed',
      created_at: new Date().toISOString(),
    });

    const body = JSON.stringify(payload, null, 2);
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="alphaclone-data-export-${user.id}-${exportDate}.json"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unexpected error' }, { status: 500 });
  }
}
