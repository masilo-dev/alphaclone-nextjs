import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';
import { sendWithProviderSdk } from '@/lib/email/providerSdk';

export const dynamic = 'force-dynamic';

function getBrevoKey() {
  return process.env.BREVO_PLATFORM_API_KEY || process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || '';
}

function getFromEmail() {
  return process.env.BREVO_PLATFORM_FROM_EMAIL || process.env.BREVO_FROM_EMAIL || 'legal@alphaclonesystems.com';
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json().catch(() => ({}));
    const companyName = String(payload.companyName || '').trim();
    const email = String(payload.email || '').trim();
    const country = String(payload.country || '').trim();
    const notes = String(payload.notes || '').trim() || null;

    if (!companyName || !email || !country) {
      return NextResponse.json({ error: 'Company name, email, and country are required.' }, { status: 400 });
    }

    if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    const supabase = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await supabase.from('dpa_requests').insert({
      company_name: companyName,
      email,
      country,
      notes,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const brevoKey = getBrevoKey();
    if (brevoKey) {
      const subject = `DPA request received from ${companyName}`;
      const text = `DPA request received from ${companyName} (${email}) in ${country}.`;
      const html = `<p>DPA request received from <strong>${companyName}</strong> (${email}) in ${country}.</p>${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}`;
      await sendWithProviderSdk('brevo', {
        apiKey: brevoKey,
        fromEmail: getFromEmail(),
        fromName: 'AlphaClone Systems',
        to: 'legal@alphaclonesystems.com',
        subject,
        html,
        text,
      });
    }

    return NextResponse.json({ success: true, message: 'DPA request received.' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unexpected error' }, { status: 500 });
  }
}
