import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, subject, message, company } = body;

    // Validate required fields
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Create Supabase client with service role key for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // TODO: Send email notification to sales team
    // await sendEmailNotification(data);

    return NextResponse.json(
      { 
        success: true, 
        message: 'Thank you for contacting us. We\'ll be in touch within 24 hours.',
        id: data.id 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
