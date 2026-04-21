import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createAdminSupabaseClientOrThrow, routeErrorResponse } from '@/lib/apiAuth';
import { contactSchema } from '@/schemas/validation';

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

    // Insert contact form submission into database
    const { data, error } = await supabase
      .from('contact_submissions')
      .insert([
        {
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

    const salesInbox = process.env.CONTACT_SALES_INBOX_EMAIL?.trim();
    const resendKey = process.env.RESEND_API_KEY;
    const fromAddress = process.env.RESEND_CONTACT_FROM?.trim() || 'AlphaClone <bookings@resend.dev>';
    if (salesInbox && resendKey) {
      try {
        const resend = new Resend(resendKey);
        await resend.emails.send({
          from: fromAddress,
          to: salesInbox,
          replyTo: email,
          subject: `Website contact: ${subject || 'General inquiry'}`,
          text: `From: ${name} <${email}>\nCompany: ${company || '—'}\n\n${message}`,
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
