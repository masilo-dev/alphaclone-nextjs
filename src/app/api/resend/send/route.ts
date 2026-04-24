import { NextRequest, NextResponse } from 'next/server';
import {
  createAdminSupabaseClientOrThrow,
  requireTenantAccess,
  routeErrorResponse,
} from '@/lib/apiAuth';
import { providerSendSchema } from '@/schemas/validation';
import { sendWithProviderSdk } from '@/lib/email/providerSdk';
import { resolveEmailProviderConfig } from '@/lib/email/providerIntegrationResolver';
import { ensureFooter, normalizeEmailSubject } from '@/lib/email/emailComposition';

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
    const payload = await request.json();
    const parsed = providerSendSchema.safeParse(payload);
    if (!parsed.success) {
      const clientError = CLIENT_ERRORS.RECIPIENT_EMAIL_ISSUE;
      return NextResponse.json({
        error: clientError,
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
        clientFriendly: true
      }, { status: 400 });
    }
    const { to, subject, message } = parsed.data;
    const normalizedSubject = normalizeEmailSubject(subject);
    if (!normalizedSubject) {
      const clientError = CLIENT_ERRORS.RECIPIENT_EMAIL_ISSUE;
      return NextResponse.json({
        error: { ...clientError, message: 'Email subject is required.' },
        code: 'VALIDATION_ERROR',
        clientFriendly: true,
      }, { status: 400 });
    }
    const normalizedMessage = ensureFooter(message);
    const tenantId = parsed.data.tenantId || parsed.data.tenant_id!;

    await requireTenantAccess(tenantId);

    const resolved = await resolveEmailProviderConfig({
      tenantId,
      preferredProvider: 'resend',
      fallbackToEnv: false,
    });
    if (!resolved || resolved.provider !== 'resend') {
      const clientError = CLIENT_ERRORS.API_KEY_ISSUE;
      return NextResponse.json({
        error: clientError,
        clientFriendly: true
      }, { status: 404 });
    }
    const supabase = createAdminSupabaseClientOrThrow();

    const sendResult = await sendWithProviderSdk('resend', {
      apiKey: resolved.apiKey,
      fromEmail: resolved.fromEmail || 'onboarding@resend.dev',
      fromName: resolved.fromName || 'AlphaClone',
      to,
      subject: normalizedSubject,
      text: normalizedMessage,
    });

    if (!sendResult.ok) {
      console.error('Resend SDK error:', sendResult.error);
      
      // Parse Resend error and translate to client-friendly message
      let clientError = CLIENT_ERRORS.EMAIL_SENDING_FAILED;
      
      if ((sendResult.error || '').includes('Unauthorized')) {
        clientError = CLIENT_ERRORS.API_KEY_ISSUE;
      } else if ((sendResult.error || '').includes('domain')) {
        clientError = CLIENT_ERRORS.DOMAIN_CONFIGURATION_PROBLEM;
      } else if ((sendResult.error || '').includes('rate limit')) {
        clientError = CLIENT_ERRORS.SENDING_LIMIT_REACHED;
      }
      
      return NextResponse.json({
        error: clientError,
        clientFriendly: true
      }, { status: 502 });
    }

    // Log the email sent
    await supabase
      .from('email_logs')
      .insert({
        tenant_id: tenantId,
        provider: 'resend',
        to_email: to,
        subject: normalizedSubject,
        status: 'sent',
        email_id: sendResult.emailId,
        created_at: new Date().toISOString()
      });

    return NextResponse.json({
      success: true,
      message: `Email sent successfully to ${to}`,
      provider: 'resend',
      emailId: sendResult.emailId
    });

  } catch (error) {
    console.error('Resend send error:', error);
    const clientError = translateErrorToClient(error);

    if ((error as any)?.name === 'RouteAuthError') {
      return routeErrorResponse(error, 'Internal server error');
    }

    return NextResponse.json({
      error: clientError,
      clientFriendly: true
    }, { status: 500 });
  }
}
