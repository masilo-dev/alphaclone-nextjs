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

const CLIENT_ERRORS = {
  API_KEY_ISSUE: {
    title: 'API Key Issue',
    message: 'Your Brevo API key is not working correctly.',
    suggestion: 'Please check your API key in settings and try again.',
    type: 'error'
  },
  SENDER_CONFIGURATION_PROBLEM: {
    title: 'Sender Configuration Problem',
    message: 'The sender email is not configured correctly.',
    suggestion: 'Check your Brevo sender settings and verify the sender domain.',
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
    message: 'Brevo has temporarily limited email sending.',
    suggestion: 'Please wait a few minutes and try again.',
    type: 'warning'
  },
  CONNECTION_PROBLEM: {
    title: 'Connection Problem',
    message: 'Cannot connect to Brevo servers right now.',
    suggestion: 'Please check your internet connection and try again.',
    type: 'warning'
  },
  EMAIL_SENDING_FAILED: {
    title: 'Email Sending Failed',
    message: 'We encountered an issue sending your test email.',
    suggestion: 'Please try again. If this continues, check your Brevo configuration.',
    type: 'error'
  }
};

function translateErrorToClient(error: unknown): typeof CLIENT_ERRORS[keyof typeof CLIENT_ERRORS] {
  const errorMessage = error instanceof Error ? error.message : String(error || 'Unknown error');
  const lowered = errorMessage.toLowerCase();

  if (lowered.includes('api key') || lowered.includes('unauthorized') || lowered.includes('forbidden')) {
    return CLIENT_ERRORS.API_KEY_ISSUE;
  }
  if (lowered.includes('sender') || lowered.includes('from')) {
    return CLIENT_ERRORS.SENDER_CONFIGURATION_PROBLEM;
  }
  if (lowered.includes('recipient') || lowered.includes('invalid') || lowered.includes('email')) {
    return CLIENT_ERRORS.RECIPIENT_EMAIL_ISSUE;
  }
  if (lowered.includes('rate') || lowered.includes('limit') || lowered.includes('too many')) {
    return CLIENT_ERRORS.SENDING_LIMIT_REACHED;
  }
  if (lowered.includes('network') || lowered.includes('timeout') || lowered.includes('connect')) {
    return CLIENT_ERRORS.CONNECTION_PROBLEM;
  }
  return CLIENT_ERRORS.EMAIL_SENDING_FAILED;
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const parsed = providerSendSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({
        error: CLIENT_ERRORS.RECIPIENT_EMAIL_ISSUE,
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
        clientFriendly: true
      }, { status: 400 });
    }

    const { to, subject, message } = parsed.data;
    const normalizedSubject = normalizeEmailSubject(subject);
    if (!normalizedSubject) {
      return NextResponse.json({
        error: { ...CLIENT_ERRORS.RECIPIENT_EMAIL_ISSUE, message: 'Email subject is required.' },
        code: 'VALIDATION_ERROR',
        clientFriendly: true
      }, { status: 400 });
    }
    const normalizedMessage = ensureFooter(message);
    const tenantId = parsed.data.tenantId || parsed.data.tenant_id!;
    await requireTenantAccess(tenantId);

    const resolved = await resolveEmailProviderConfig({
      tenantId,
      fallbackToEnv: false,
    });
    if (!resolved || resolved.provider !== 'brevo') {
      return NextResponse.json({
        error: CLIENT_ERRORS.API_KEY_ISSUE,
        clientFriendly: true
      }, { status: 404 });
    }
    const supabase = createAdminSupabaseClientOrThrow();

    const sendResult = await sendWithProviderSdk('brevo', {
      apiKey: resolved.apiKey,
      fromEmail: resolved.fromEmail || 'noreply@yourdomain.com',
      fromName: resolved.fromName || 'AlphaClone',
      to,
      subject: normalizedSubject,
      text: normalizedMessage,
    });

    if (!sendResult.ok) {
      return NextResponse.json({
        error: translateErrorToClient(sendResult.error),
        clientFriendly: true
      }, { status: 502 });
    }

    await supabase
      .from('email_logs')
      .insert({
        tenant_id: tenantId,
        provider: 'brevo',
        to_email: to,
        subject: normalizedSubject,
        status: 'sent',
        email_id: sendResult.emailId || null,
        created_at: new Date().toISOString()
      });

    return NextResponse.json({
      success: true,
      message: `Email sent successfully to ${to}`,
      provider: 'brevo',
      emailId: sendResult.emailId
    });
  } catch (error) {
    console.error('Brevo send error:', error);
    if ((error as any)?.name === 'RouteAuthError') {
      return routeErrorResponse(error, 'Internal server error');
    }
    return NextResponse.json({
      error: translateErrorToClient(error),
      clientFriendly: true
    }, { status: 500 });
  }
}

