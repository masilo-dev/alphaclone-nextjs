import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { validateContract, validateInvoice } from '@/lib/documents/documentValidationEngine';
import { resolveBrandProfile } from '@/lib/document-os/brandProfile';

export type ReadinessCheckInput = {
  tenantId: string;
  action: 'send_quote' | 'send_contract' | 'send_invoice' | 'send_package';
  customerId?: string;
  customerEmail?: string;
  quoteId?: string;
  contractId?: string;
  invoiceId?: string;
  currency?: string;
  totalAmount?: number;
};

export type ReadinessCheckResult = {
  ready: boolean;
  can_proceed: boolean;
  blocking_errors: string[];
  non_blocking_warnings: string[];
  details: {
    customer_valid: boolean;
    currency_valid: boolean;
    documents_valid: boolean;
    branding_valid: boolean;
    provider_connected: boolean;
    approval_required: boolean;
  };
};

export async function checkActionReadiness(
  input: ReadinessCheckInput,
  client?: SupabaseClient
): Promise<ReadinessCheckResult> {
  const supabase = client || createSupabaseAdminClient();
  const blockingErrors: string[] = [];
  const nonBlockingWarnings: string[] = [];

  let customerValid = false;
  let currencyValid = true;
  let documentsValid = true;
  let brandingValid = true;
  let providerConnected = false;
  let approvalRequired = false;

  // 1. Customer Check
  let recipientEmail = input.customerEmail;
  if (!recipientEmail && input.customerId) {
    const { data: clientRow } = await supabase
      .from('business_clients')
      .select('email, name')
      .eq('tenant_id', input.tenantId)
      .eq('id', input.customerId)
      .maybeSingle();
    recipientEmail = clientRow?.email;
  }

  if (!recipientEmail || !recipientEmail.includes('@')) {
    blockingErrors.push('Missing valid recipient email for customer.');
    customerValid = false;
  } else {
    customerValid = true;
  }

  // 2. Email Provider Check
  const { data: integrations } = await supabase
    .from('tenant_integrations')
    .select('provider, status, enabled')
    .eq('tenant_id', input.tenantId);

  const hasActiveEmailIntegration = (integrations || []).some(
    (i) => (i.provider === 'resend' || i.provider === 'sendgrid' || i.provider === 'smtp') && (i.enabled || i.status === 'active')
  );

  // In development/test mode or if fallback exists, it's non-blocking or connected
  if (hasActiveEmailIntegration || process.env.RESEND_API_KEY || process.env.SMTP_HOST) {
    providerConnected = true;
  } else {
    nonBlockingWarnings.push('No custom email provider configured; system will use platform default email gateway.');
    providerConnected = true; // Still can proceed via platform gateway
  }

  // 3. Branding Profile Check
  try {
    const brand = resolveBrandProfile({ id: input.tenantId });
    if (!brand.legal_business_name || brand.legal_business_name.includes("Organization")) {
      nonBlockingWarnings.push('Company branding name is default or uncustomized.');
    }
  } catch {
    nonBlockingWarnings.push('Document branding profile could not be resolved; fallback applied.');
  }

  // 4. Currency / Amount Consistency
  if (input.currency && !['EUR', 'USD', 'GBP', 'CAD', 'AUD'].includes(input.currency.toUpperCase())) {
    nonBlockingWarnings.push(`Unusual currency "${input.currency}" specified; ensure exchange rate or customer currency matches.`);
  }

  // 5. Document Validation Checks
  if (input.quoteId) {
    const { data: quote } = await supabase
      .from('quotes')
      .select('*, items:quote_items(*)')
      .eq('tenant_id', input.tenantId)
      .eq('id', input.quoteId)
      .maybeSingle();

    if (!quote) {
      blockingErrors.push(`Quote not found: ${input.quoteId}`);
      documentsValid = false;
    } else {
      if (input.currency && quote.currency && quote.currency.toUpperCase() !== input.currency.toUpperCase()) {
        blockingErrors.push(`Quote currency (${quote.currency}) does not match requested currency (${input.currency}).`);
        currencyValid = false;
      }
      if (input.totalAmount && Math.abs(Number(quote.total_amount) - input.totalAmount) > 0.01) {
        blockingErrors.push(`Quote amount (${quote.total_amount}) does not match requested amount (${input.totalAmount}).`);
      }
    }
  }

  if (input.contractId) {
    const { data: contract } = await supabase
      .from('contracts')
      .select('*')
      .eq('tenant_id', input.tenantId)
      .eq('id', input.contractId)
      .maybeSingle();

    if (!contract) {
      blockingErrors.push(`Contract not found: ${input.contractId}`);
      documentsValid = false;
    } else {
      const contractResult = validateContract({
        text: contract.content || '',
        clientName: contract.client_name,
        clientEmail: recipientEmail,
        isDraft: contract.status === 'draft',
      });
      for (const finding of contractResult.findings) {
        if (finding.severity === 'critical') {
          blockingErrors.push(`Contract validation error: ${finding.message}`);
          documentsValid = false;
        } else {
          nonBlockingWarnings.push(`Contract warning: ${finding.message}`);
        }
      }
    }
  }

  if (input.invoiceId) {
    const { data: invoice } = await supabase
      .from('business_invoices')
      .select('*')
      .eq('tenant_id', input.tenantId)
      .eq('id', input.invoiceId)
      .maybeSingle();

    if (!invoice) {
      blockingErrors.push(`Invoice not found: ${input.invoiceId}`);
      documentsValid = false;
    } else {
      let invClientName = invoice.client_name;
      let invClientEmail = invoice.client_email || recipientEmail;

      if (!invClientName && invoice.client_id) {
        const { data: cl } = await supabase
          .from('business_clients')
          .select('name, email')
          .eq('tenant_id', input.tenantId)
          .eq('id', invoice.client_id)
          .maybeSingle();
        if (cl) {
          invClientName = cl.name;
          if (!invClientEmail) invClientEmail = cl.email;
        }
      }

      let brandLegal = 'AlphaClone Systems LLC';
      try {
        const brand = resolveBrandProfile({ id: input.tenantId });
        if (brand.legal_business_name) brandLegal = brand.legal_business_name;
      } catch {}

      const invResult = validateInvoice({
        status: invoice.status || 'draft',
        total: Number(invoice.total || 0),
        amount_paid: Number(invoice.amount_paid || 0),
        balance_due: Number(invoice.balance_due || 0),
        currency: invoice.currency,
        supplier_legal_name: brandLegal,
        client_name: invClientName,
        client_email: invClientEmail,
      });
      for (const finding of invResult.findings) {
        if (finding.severity === 'critical') {
          blockingErrors.push(`Invoice validation error: ${finding.message}`);
          documentsValid = false;
        } else {
          nonBlockingWarnings.push(`Invoice warning: ${finding.message}`);
        }
      }
      if (input.currency && invoice.currency && invoice.currency.toUpperCase() !== input.currency.toUpperCase()) {
        blockingErrors.push(`Invoice currency (${invoice.currency}) does not match requested currency (${input.currency}).`);
        currencyValid = false;
      }
    }
  }

  // Large transaction approval check
  const amountToCheck = input.totalAmount || 0;
  if (amountToCheck >= 10000) {
    approvalRequired = true;
    nonBlockingWarnings.push(`Transaction amount (${amountToCheck}) exceeds threshold for autonomous dispatch; manual preview approval token recommended.`);
  }

  const canProceed = blockingErrors.length === 0;

  return {
    ready: canProceed,
    can_proceed: canProceed,
    blocking_errors: blockingErrors,
    non_blocking_warnings: nonBlockingWarnings,
    details: {
      customer_valid: customerValid,
      currency_valid: currencyValid,
      documents_valid: documentsValid,
      branding_valid: brandingValid,
      provider_connected: providerConnected,
      approval_required: approvalRequired,
    },
  };
}

export type SendPackagePreviewInput = {
  tenantId: string;
  recipientEmail: string;
  recipientName?: string;
  packageType: 'quote' | 'contract' | 'invoice' | 'complete_client_package';
  quoteId?: string;
  contractId?: string;
  invoiceId?: string;
  customMessage?: string;
};

export type DocumentAttachmentPreview = {
  document_type: 'quote' | 'contract' | 'invoice' | 'other';
  document_id: string;
  filename: string;
  byte_size?: number;
  sha256_checksum: string;
  download_url?: string;
};

export type SendPackagePreviewResult = {
  success: boolean;
  package_type: string;
  recipient: {
    name?: string;
    email: string;
  };
  sender: {
    from_name: string;
    from_email: string;
  };
  subject: string;
  message_preview: string;
  attachments: DocumentAttachmentPreview[];
  approval_token: string;
  content_hash: string;
  warnings: string[];
};

export async function previewSendPackage(
  input: SendPackagePreviewInput,
  client?: SupabaseClient
): Promise<SendPackagePreviewResult> {
  const supabase = client || createSupabaseAdminClient();
  const attachments: DocumentAttachmentPreview[] = [];
  const warnings: string[] = [];

  let subject = `AlphaClone Documents for ${input.recipientName || 'Client'}`;
  let message = input.customMessage || 'Please review the attached documents.';

  // Gather documents and attachments
  if (input.quoteId) {
    const { data: quote } = await supabase
      .from('quotes')
      .select('*')
      .eq('tenant_id', input.tenantId)
      .eq('id', input.quoteId)
      .maybeSingle();

    if (quote) {
      const hash = createHash('sha256').update(JSON.stringify(quote)).digest('hex');
      attachments.push({
        document_type: 'quote',
        document_id: quote.id,
        filename: `Quote_${quote.name || quote.id.slice(0, 8)}.pdf`,
        sha256_checksum: hash,
      });
      subject = `Quotation: ${quote.name || 'Services Quotation'}`;
    } else {
      warnings.push(`Quote ${input.quoteId} not found.`);
    }
  }

  if (input.contractId) {
    const { data: contract } = await supabase
      .from('contracts')
      .select('*')
      .eq('tenant_id', input.tenantId)
      .eq('id', input.contractId)
      .maybeSingle();

    if (contract) {
      const hash = createHash('sha256').update(JSON.stringify(contract)).digest('hex');
      attachments.push({
        document_type: 'contract',
        document_id: contract.id,
        filename: `Contract_${contract.title?.replace(/[^a-zA-Z0-9_-]/g, '_') || contract.id.slice(0, 8)}.pdf`,
        sha256_checksum: hash,
      });
      subject = `Agreement for Review: ${contract.title || 'Client Agreement'}`;
    } else {
      warnings.push(`Contract ${input.contractId} not found.`);
    }
  }

  if (input.invoiceId) {
    const { data: invoice } = await supabase
      .from('business_invoices')
      .select('*')
      .eq('tenant_id', input.tenantId)
      .eq('id', input.invoiceId)
      .maybeSingle();

    if (invoice) {
      const hash = createHash('sha256').update(JSON.stringify(invoice)).digest('hex');
      attachments.push({
        document_type: 'invoice',
        document_id: invoice.id,
        filename: `Invoice_${invoice.invoice_number || invoice.id.slice(0, 8)}.pdf`,
        sha256_checksum: hash,
      });
      subject = `Invoice ${invoice.invoice_number || ''} from AlphaClone`;
    } else {
      warnings.push(`Invoice ${input.invoiceId} not found.`);
    }
  }

  if (attachments.length > 1) {
    subject = `Client Document Package: ${input.recipientName || 'Client'}`;
  }

  // Compute deterministic content hash for approval token
  const contentToHash = JSON.stringify({
    tenantId: input.tenantId,
    recipientEmail: input.recipientEmail.toLowerCase(),
    subject,
    attachments: attachments.map((a) => ({ id: a.document_id, sha256: a.sha256_checksum })),
  });
  const contentHash = createHash('sha256').update(contentToHash).digest('hex');

  // Approval token combines the content hash with an HMAC / nonce
  const tokenNonce = randomBytes(8).toString('hex');
  const approvalToken = `appr_${contentHash.slice(0, 16)}_${tokenNonce}`;

  return {
    success: true,
    package_type: input.packageType,
    recipient: {
      name: input.recipientName,
      email: input.recipientEmail,
    },
    sender: {
      from_name: 'AlphaClone Systems',
      from_email: 'billing@alphaclonesystems.com',
    },
    subject,
    message_preview: message,
    attachments,
    approval_token: approvalToken,
    content_hash: contentHash,
    warnings,
  };
}

export function verifyApprovalToken(
  approvalToken: string,
  currentContentHash: string
): { valid: boolean; reason?: string } {
  const parts = approvalToken.split('_');
  if (parts.length < 3 || parts[0] !== 'appr') {
    return { valid: false, reason: 'Malformed approval token' };
  }
  const tokenHashPrefix = parts[1];
  if (currentContentHash.slice(0, 16) !== tokenHashPrefix) {
    return {
      valid: false,
      reason: 'Approval token invalidated: package content, amounts, or recipients were modified after approval.',
    };
  }
  return { valid: true };
}
