import { NextRequest, NextResponse } from 'next/server';
import {
  createAdminSupabaseClientOrThrow,
  requireTenantAccess,
  routeErrorResponse,
} from '@/lib/apiAuth';
import { providerSendSchema } from '@/schemas/validation';
import { sendWithProviderSdk, type EmailProvider } from '@/lib/email/providerSdk';
import { resolveEmailProviderConfig } from '@/lib/email/providerIntegrationResolver';
import { ensureFooter, normalizeEmailSubject } from '@/lib/email/emailComposition';

export type ClientFriendlyError = {
  title: string;
  message: string;
  suggestion: string;
  type: 'error' | 'warning';
};

type ProviderSendConfig = {
  provider: EmailProvider;
  displayName: string;
  defaultFromEmail?: string;
  envFromEmailVar?: string;
};

const PROVIDER_CONFIG: Record<'resend' | 'sendgrid' | 'brevo', ProviderSendConfig> = {
  resend: {
    provider: 'resend',
    displayName: 'Resend',
    envFromEmailVar: 'RESEND_FROM_EMAIL',
  },
  sendgrid: {
    provider: 'sendgrid',
    displayName: 'SendGrid',
  },
  brevo: {
    provider: 'brevo',
    displayName: 'Brevo',
  },
};

function buildClientErrors(displayName: string) {
  return {
    API_KEY_ISSUE: {
      title: 'API Key Issue',
      message: `Your ${displayName} API key is not working correctly.`,
      suggestion: 'Please check your API key in settings and try again.',
      type: 'error' as const,
    },
    SENDER_CONFIGURATION_PROBLEM: {
      title: 'Sender Configuration Problem',
      message: 'The sender email is not configured correctly.',
      suggestion: `Check your ${displayName} sender settings and verify the sender domain.`,
      type: 'error' as const,
    },
    DOMAIN_CONFIGURATION_PROBLEM: {
      title: 'Domain Configuration Problem',
      message: 'Your sending domain is not configured correctly.',
      suggestion: `Check your domain settings in the ${displayName} dashboard.`,
      type: 'error' as const,
    },
    RECIPIENT_EMAIL_ISSUE: {
      title: 'Recipient Email Issue',
      message: 'The recipient email address is not valid.',
      suggestion: 'Please double-check the email address and try again.',
      type: 'warning' as const,
    },
    SENDING_LIMIT_REACHED: {
      title: 'Sending Limit Reached',
      message: `${displayName} has temporarily limited email sending.`,
      suggestion: 'Please wait a few minutes and try again.',
      type: 'warning' as const,
    },
    CONNECTION_PROBLEM: {
      title: 'Connection Problem',
      message: `Cannot connect to ${displayName} servers right now.`,
      suggestion: 'Please check your internet connection and try again.',
      type: 'warning' as const,
    },
    EMAIL_SENDING_FAILED: {
      title: 'Email Sending Failed',
      message: 'We encountered an issue sending your test email.',
      suggestion: `Please try again. If this continues, check your ${displayName} configuration.`,
      type: 'error' as const,
    },
  };
}

function translateErrorToClient(
  error: unknown,
  errors: ReturnType<typeof buildClientErrors>
): ClientFriendlyError {
  const errorMessage = error instanceof Error ? error.message : String(error || 'Unknown error');
  const lowered = errorMessage.toLowerCase();

  if (lowered.includes('invalid_api_key') || lowered.includes('unauthorized') || lowered.includes('forbidden')) {
    return errors.API_KEY_ISSUE;
  }
  if (lowered.includes('domain') || lowered.includes('from_address') || lowered.includes('invalid from')) {
    return errors.DOMAIN_CONFIGURATION_PROBLEM;
  }
  if (lowered.includes('sender') || lowered.includes('from address')) {
    return errors.SENDER_CONFIGURATION_PROBLEM;
  }
  if (lowered.includes('recipient') || lowered.includes('invalid email')) {
    return errors.RECIPIENT_EMAIL_ISSUE;
  }
  if (lowered.includes('rate_limit') || lowered.includes('rate limit') || lowered.includes('too many')) {
    return errors.SENDING_LIMIT_REACHED;
  }
  if (lowered.includes('network') || lowered.includes('timeout') || lowered.includes('connect')) {
    return errors.CONNECTION_PROBLEM;
  }
  return errors.EMAIL_SENDING_FAILED;
}

function resolveDefaultFromEmail(config: ProviderSendConfig): string | undefined {
  if (config.envFromEmailVar) {
    return process.env[config.envFromEmailVar] || process.env.EMAIL_FROM;
  }
  return process.env.EMAIL_FROM;
}

export async function handleProviderSend(
  request: NextRequest,
  providerId: 'resend' | 'sendgrid' | 'brevo'
): Promise<NextResponse> {
  const config = PROVIDER_CONFIG[providerId];
  const CLIENT_ERRORS = buildClientErrors(config.displayName);

  try {
    const payload = await request.json();
    const parsed = providerSendSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({
        error: CLIENT_ERRORS.RECIPIENT_EMAIL_ISSUE,
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
        clientFriendly: true,
      }, { status: 400 });
    }

    const { to, subject, message } = parsed.data;
    const normalizedSubject = normalizeEmailSubject(subject);
    if (!normalizedSubject) {
      return NextResponse.json({
        error: { ...CLIENT_ERRORS.RECIPIENT_EMAIL_ISSUE, message: 'Email subject is required.' },
        code: 'VALIDATION_ERROR',
        clientFriendly: true,
      }, { status: 400 });
    }

    const normalizedMessage = ensureFooter(message);
    const tenantId = parsed.data.tenantId || parsed.data.tenant_id!;
    await requireTenantAccess(tenantId);

    const resolved = await resolveEmailProviderConfig({
      tenantId,
      preferredProvider: providerId,
      fallbackToEnv: false,
    });
    if (!resolved || resolved.provider !== providerId) {
      return NextResponse.json({
        error: CLIENT_ERRORS.API_KEY_ISSUE,
        clientFriendly: true,
      }, { status: 404 });
    }

    const supabase = createAdminSupabaseClientOrThrow();
    const fromEmail =
      resolved.fromEmail ||
      resolveDefaultFromEmail(config) ||
      'noreply@yourdomain.com';

    if (providerId === 'resend' && !resolved.fromEmail && !resolveDefaultFromEmail(config)) {
      return NextResponse.json({
        error: 'Sender email not configured. Set RESEND_FROM_EMAIL or tenant sender profile.',
        clientFriendly: true,
      }, { status: 400 });
    }

    const sendResult = await sendWithProviderSdk(providerId, {
      apiKey: resolved.apiKey,
      fromEmail,
      fromName: resolved.fromName || 'AlphaClone',
      to,
      subject: normalizedSubject,
      text: normalizedMessage,
    });

    if (!sendResult.ok) {
      console.error(`${config.displayName} SDK error:`, sendResult.error);
      return NextResponse.json({
        error: translateErrorToClient(sendResult.error, CLIENT_ERRORS),
        clientFriendly: true,
      }, { status: 502 });
    }

    await supabase.from('email_logs').insert({
      tenant_id: tenantId,
      provider: providerId,
      to_email: to,
      subject: normalizedSubject,
      status: 'sent',
      email_id: sendResult.emailId || null,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Email sent successfully to ${to}`,
      provider: providerId,
      emailId: sendResult.emailId,
    });
  } catch (error) {
    console.error(`${config.displayName} send error:`, error);
    if ((error as { name?: string })?.name === 'RouteAuthError') {
      return routeErrorResponse(error, 'Internal server error');
    }
    return NextResponse.json({
      error: translateErrorToClient(error, CLIENT_ERRORS),
      clientFriendly: true,
    }, { status: 500 });
  }
}
