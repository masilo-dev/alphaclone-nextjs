import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClientOrThrow, routeErrorResponse } from '@/lib/apiAuth';
import { contactSchema } from '@/schemas/validation';
import { sendEmailServer } from '@/lib/email/sendEmailServer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { name, email, subject, message, company } = parsed.data;

    const supabase = createAdminSupabaseClientOrThrow();
    const salesInbox = process.env.CONTACT_SALES_INBOX_EMAIL?.trim();
    const tenantId = process.env.CONTACT_TENANT_ID?.trim();

    // Insert contact form submission into database
    const { data, error } = await supabase
      .from('contact_submissions')
      .insert([
        {
          tenant_id: tenantId || null,
          name,
          email,
          subject: subject || 'General Inquiry',
          message,
          company: company || null,
          status: 'new',
          source: 'website',
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error saving contact submission:', error);
      return NextResponse.json(
        { error: 'Failed to save submission' },
        { status: 500 }
      );
    }

    if (salesInbox && tenantId) {
      try {
        await sendEmailServer({
          tenantId,
          to: salesInbox,
          replyTo: email,
          subject: `Website contact: ${subject || 'General inquiry'}`,
          text: `From: ${name} <${email}>\nCompany: ${company || '—'}\n\n${message}`,
          templateName: 'websiteContact',
        });
      } catch (notifyErr) {
        console.error('Contact form sales notification failed:', notifyErr);
      }
    }

    return NextResponse.json(
      { 
        success: true, 
        message: 'Thank you for contacting us. We\'ll be in touch within 24 hours.',
        id: data.id 
      },
      { status: 200 }
    );
  } catch (error) {
    return routeErrorResponse(error, 'Internal server error');
  }
}
