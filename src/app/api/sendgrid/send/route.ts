<<<<<<< HEAD
import { NextRequest } from 'next/server';
import { handleProviderSend } from '@/lib/email/handleProviderSend';

export async function POST(request: NextRequest) {
  return handleProviderSend(request, 'sendgrid');
=======
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
    message: 'Your SendGrid API key is not working correctly.',
    suggestion: 'Please check your API key in settings and try again.',
    type: 'error'
  },
  FROM_EMAIL_PROBLEM: {
    title: 'From Email Problem',
    message: 'The sender email address is not configured correctly.',
    suggestion: 'Check your SendGrid from email settings in integration configuration.',
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
    message: 'SendGrid has temporarily limited email sending.',
    suggestion: 'Please wait a few minutes and try again.',
    type: 'warning'
  },
  CONNECTION_PROBLEM: {
    title: 'Connection Problem',
    message: 'Cannot connect to SendGrid servers right now.',
    suggestion: 'Please check your internet connection and try again.',
    type: 'warning'
  },
  EMAIL_SENDING_FAILED: {
    title: 'Email Sending Failed',
    message: 'We encountered an issue sending your test email.',
    suggestion: 'Please try again. If this continues, check your SendGrid configuration.',
    type: 'error'
  }
};

function translateErrorToClient(error: any): typeof CLIENT_ERRORS[keyof typeof CLIENT_ERRORS] {
  const errorMessage = error?.message || error?.toString() || 'Unknown error';
  
  // SendGrid specific errors
  if (errorMessage.includes('invalid_api_key') || errorMessage.includes('unauthorized')) {
    return CLIENT_ERRORS.API_KEY_ISSUE;
  }
  
  if (errorMessage.includes('from_address') || errorMessage.includes('invalid from')) {
    return CLIENT_ERRORS.FROM_EMAIL_PROBLEM;
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
      preferredProvider: 'sendgrid',
      fallbackToEnv: false,
    });
    if (!resolved || resolved.provider !== 'sendgrid') {
      const clientError = CLIENT_ERRORS.API_KEY_ISSUE;
      return NextResponse.json({
        error: clientError,
        clientFriendly: true
      }, { status: 404 });
    }
    const supabase = createAdminSupabaseClientOrThrow();

    const sendResult = await sendWithProviderSdk('sendgrid', {
      apiKey: resolved.apiKey,
      fromEmail: resolved.fromEmail || 'noreply@yourdomain.com',
      fromName: resolved.fromName || 'AlphaClone',
      to,
      subject: normalizedSubject,
      text: normalizedMessage,
    });

    if (!sendResult.ok) {
      const errorData = sendResult.error || '';
      console.error('SendGrid SDK error:', errorData);
      
      // Parse SendGrid error and translate to client-friendly message
      let clientError = CLIENT_ERRORS.EMAIL_SENDING_FAILED;
      
      if (errorData.includes('unauthorized')) {
        clientError = CLIENT_ERRORS.API_KEY_ISSUE;
      } else if (errorData.includes('from address')) {
        clientError = CLIENT_ERRORS.FROM_EMAIL_PROBLEM;
      } else if (errorData.includes('rate limit')) {
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
        provider: 'sendgrid',
        to_email: to,
        subject: normalizedSubject,
        status: 'sent',
        created_at: new Date().toISOString()
      });

    return NextResponse.json({
      success: true,
      message: `Email sent successfully to ${to}`,
      provider: 'sendgrid'
    });

  } catch (error) {
    console.error('SendGrid send error:', error);
    const clientError = translateErrorToClient(error);

    if ((error as any)?.name === 'RouteAuthError') {
      return routeErrorResponse(error, 'Internal server error');
    }

    return NextResponse.json({
      error: clientError,
      clientFriendly: true
    }, { status: 500 });
  }
>>>>>>> origin/main
}
