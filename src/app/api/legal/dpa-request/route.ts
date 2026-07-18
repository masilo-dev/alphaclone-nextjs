import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';
import { sendWithProviderSdk } from '@/lib/email/providerSdk';
import { requireAuthenticatedUser, routeErrorResponse } from '@/lib/apiAuth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

function getBrevoKey() {
  return process.env.BREVO_PLATFORM_API_KEY || process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || '';
}

function getFromEmail() {
  return process.env.BREVO_PLATFORM_FROM_EMAIL || process.env.BREVO_FROM_EMAIL || 'legal@alphaclonesystems.com';
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function POST(req: NextRequest) {
  try {
    await requireAuthenticatedUser(req);
    const { companyName, email, country, notes } = z.object({
      companyName: z.string().trim().min(1).max(200),
      email: z.string().trim().email().max(320),
      country: z.string().trim().min(2).max(100),
      notes: z.string().trim().max(4000).optional(),
    }).parse(await req.json().catch(() => ({})));

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
      const html = `<p>DPA request received from <strong>${escapeHtml(companyName)}</strong> (${escapeHtml(email)}) in ${escapeHtml(country)}.</p>${notes ? `<p><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ''}`;
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
    return routeErrorResponse(error, 'DPA request could not be submitted', req);
  }
}
