import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

// Client-friendly error messages
const CLIENT_ERRORS = {
  API_KEY_ISSUE: {
    title: 'API Key Issue',
    message: 'Your Resend API key is not working correctly.',
    suggestion: 'Please check your API key in settings and try again.',
    type: 'error'
  },
  DOMAIN_CONFIGURATION_PROBLEM: {
    title: 'Domain Configuration Problem',
    message: 'Your sending domain is not configured correctly.',
    suggestion: 'Check your domain settings in the Resend dashboard.',
    type: 'error'
  },
  RECIPIENT_EMAIL_ISSUE: {
    title: 'Recipient Email Issue',
    message: 'The recipient email address is not valid.',
    suggestion: 'Please double-check the email address and try again.',
    type: 'warning'
  },
  SENDING_LIMIT_REACHED: {
    title: 'Sending Limit Reached',
    message: 'Resend has temporarily limited email sending.',
    suggestion: 'Please wait a few minutes and try again.',
    type: 'warning'
  },
  CONNECTION_PROBLEM: {
    title: 'Connection Problem',
    message: 'Cannot connect to Resend servers right now.',
    suggestion: 'Please check your internet connection and try again.',
    type: 'warning'
  },
  EMAIL_SENDING_FAILED: {
    title: 'Email Sending Failed',
    message: 'We encountered an issue sending your test email.',
    suggestion: 'Please try again. If this continues, check your Resend configuration.',
    type: 'error'
  }
};

function translateErrorToClient(error: any): typeof CLIENT_ERRORS[keyof typeof CLIENT_ERRORS] {
  const errorMessage = error?.message || error?.toString() || 'Unknown error';
  
  // Resend specific errors
  if (errorMessage.includes('invalid_api_key') || errorMessage.includes('unauthorized')) {
    return CLIENT_ERRORS.API_KEY_ISSUE;
  }
  
  if (errorMessage.includes('domain') || errorMessage.includes('from_address')) {
    return CLIENT_ERRORS.DOMAIN_CONFIGURATION_PROBLEM;
  }
  
  if (errorMessage.includes('recipient') || errorMessage.includes('invalid email')) {
    return CLIENT_ERRORS.RECIPIENT_EMAIL_ISSUE;
  }
  
  if (errorMessage.includes('rate_limit') || errorMessage.includes('too many requests')) {
    return CLIENT_ERRORS.SENDING_LIMIT_REACHED;
  }
  
  if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
    return CLIENT_ERRORS.CONNECTION_PROBLEM;
  }
  
  // Default to email sending failed
  return CLIENT_ERRORS.EMAIL_SENDING_FAILED;
}

export async function POST(request: NextRequest) {
  try {
    const { tenant_id, to, subject, message } = await request.json();

    if (!tenant_id || !to || !subject || !message) {
      const clientError = CLIENT_ERRORS.RECIPIENT_EMAIL_ISSUE;
      return NextResponse.json({
        error: clientError,
        clientFriendly: true
      }, { status: 400 });
    }

    // Basic email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(to)) {
      const clientError = CLIENT_ERRORS.RECIPIENT_EMAIL_ISSUE;
      return NextResponse.json({
        error: clientError,
        clientFriendly: true
      }, { status: 400 });
    }

    // Get Resend integration for this tenant
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: integration, error } = await supabase
      .from('tenant_integrations')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('integration_type', 'resend')
      .eq('status', 'active')
      .single();

    if (error || !integration) {
      const clientError = CLIENT_ERRORS.API_KEY_ISSUE;
      return NextResponse.json({
        error: clientError,
        clientFriendly: true
      }, { status: 404 });
    }

    // Send email using Resend API
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: integration.from_email || `onboarding@${integration.domain || 'resend.dev'}`,
        to: [to],
        subject: subject,
        text: message
      })
    });

    const responseData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend API error:', responseData);
      
      // Parse Resend error and translate to client-friendly message
      let clientError = CLIENT_ERRORS.EMAIL_SENDING_FAILED;
      
      if (responseData.message?.includes('Unauthorized')) {
        clientError = CLIENT_ERRORS.API_KEY_ISSUE;
      } else if (responseData.message?.includes('domain')) {
        clientError = CLIENT_ERRORS.DOMAIN_CONFIGURATION_PROBLEM;
      } else if (responseData.message?.includes('rate limit')) {
        clientError = CLIENT_ERRORS.SENDING_LIMIT_REACHED;
      }
      
      return NextResponse.json({
        error: clientError,
        clientFriendly: true
      }, { status: resendResponse.status });
    }

    // Log the email sent
    await supabase
      .from('email_logs')
      .insert({
        tenant_id,
        provider: 'resend',
        to_email: to,
        subject,
        status: 'sent',
        email_id: responseData.id,
        created_at: new Date().toISOString()
      });

    return NextResponse.json({
      success: true,
      message: `Email sent successfully to ${to}`,
      provider: 'resend',
      emailId: responseData.id
    });

  } catch (error) {
    console.error('Resend send error:', error);
    const clientError = translateErrorToClient(error);
    
    return NextResponse.json({
      error: clientError,
      clientFriendly: true
    }, { status: 500 });
  }
}
