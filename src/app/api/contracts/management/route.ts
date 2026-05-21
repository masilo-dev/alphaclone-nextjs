import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { start } from 'workflow/api';
import { contractLifecycleWorkflow } from '@/workflows/contract-lifecycle';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { operationFailed } from '@/lib/api/operationResult';
import { BrowserManager } from '@/lib/scraper/browserManager';
import { requireTenantAccess } from '@/lib/apiAuth';
import { sendWithProviderSdk, type EmailProvider } from '@/lib/email/providerSdk';
import { resolveEmailProviderConfig } from '@/lib/email/providerIntegrationResolver';
import { randomBytes } from 'crypto';
import { AppUrls } from '@/lib/urls';
import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
} from 'docx';

export async function POST(req: NextRequest) {
  try {
    const { tenantId, action, config } = await req.json();

    if (!tenantId || !action) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }
    const { user } = await requireTenantAccess(tenantId);

    const supabase = createSupabaseAdminClient();
    await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

    switch (action) {
      case 'create_contract':
        return NextResponse.json(await createContract(tenantId, config, supabase));
      case 'update_contract':
        return NextResponse.json(await updateContract(tenantId, config, supabase));
      case 'get_contracts':
        return NextResponse.json(await getContracts(tenantId, config, supabase));
      case 'download_contract':
        return NextResponse.json(await downloadContract(tenantId, config, supabase));
      case 'send_contract':
        return NextResponse.json(await sendContract(tenantId, config, supabase, user.id));
      case 'delete_contract':
        return NextResponse.json(await deleteContract(tenantId, config, supabase));
      case 'get_templates':
        return NextResponse.json(await getTemplates(tenantId, supabase));
      case 'create_template':
        return NextResponse.json(await createTemplate(tenantId, config, supabase, user.id));
      case 'get_contract_versions':
        return NextResponse.json(await getContractVersions(tenantId, config, supabase));
      case 'create_contract_version':
        return NextResponse.json(await createContractVersion(tenantId, config, supabase, user.id));
      case 'request_contract_approval':
        return NextResponse.json(await requestContractApproval(tenantId, config, supabase, user.id));
      case 'review_contract_approval':
        return NextResponse.json(await reviewContractApproval(tenantId, config, supabase));
      default:
        return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('Contract management error:', error);
    return clientErrorResponse(error, { request: req, scope: 'contracts/management.POST' });
  }
}

async function createContract(tenantId: string, config: any, supabase: any) {
  try {
    const {
      title,
      type,
      parties,
      terms,
      duration,
      payment,
      pages = 2,
      fontSize = 12,
      lineSpacing = 1.2,
      template = 'standard'
    } = config;

    // Generate AI-powered contract content
    const contractContent = await generateAIContractContent({
      type,
      parties,
      terms,
      duration,
      payment,
      pages,
      fontSize,
      lineSpacing,
      template
    });

    // Save contract to database
    const { data: contract, error } = await supabase
      .from('contracts')
      .insert({
        tenant_id: tenantId,
        title: title || `${type} Agreement`,
        type: type,
        content: contractContent,
        parties: parties,
        terms: terms,
        duration: duration,
        payment: payment,
        pages: pages,
        font_size: fontSize,
        line_spacing: lineSpacing,
        template: template,
        status: 'draft',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data: contract,
      message: 'Contract created successfully'
    };
  } catch (error: any) {
    return operationFailed('contracts/management', error);
  }
}

async function updateContract(tenantId: string, config: any, supabase: any) {
  try {
    const { contractId, updates } = config;

    // Update contract
    const { data: contract, error } = await supabase
      .from('contracts')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', contractId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data: contract,
      message: 'Contract updated successfully'
    };
  } catch (error: any) {
    return operationFailed('contracts/management', error);
  }
}

async function getContracts(tenantId: string, config: any, supabase: any) {
  try {
    const { page = 1, limit = 10, status, type } = config;

    let query = supabase
      .from('contracts')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (status) {
      query = query.eq('status', status);
    }

    if (type) {
      query = query.eq('type', type);
    }

    const { data: contracts, error, count } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) throw error;

    return {
      success: true,
      data: {
        contracts: contracts || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / limit)
        }
      }
    };
  } catch (error: any) {
    return operationFailed('contracts/management', error);
  }
}

async function downloadContract(tenantId: string, config: any, supabase: any) {
  try {
    const { contractId, format = 'pdf', optimize = true } = config;

    // Get contract from database
    const { data: contract, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !contract) {
      return { success: false, error: 'Contract not found' };
    }

    // Generate optimized PDF
    const pdfBuffer = await generateOptimizedContractPDF({
      content: contract.content,
      fontSize: contract.font_size || 12,
      lineSpacing: contract.line_spacing || 1.2,
      targetPages: contract.pages || 2,
      format: format,
      optimize: optimize,
      template: contract.template || 'standard'
    });

    // Update download count
    await supabase
      .from('contracts')
      .update({ 
        download_count: (contract.download_count || 0) + 1,
        last_downloaded: new Date().toISOString()
      })
      .eq('id', contractId);

    return {
      success: true,
      data: {
        filename: `${contract.title.replace(/[^a-zA-Z0-9]/g, '_')}.${format}`,
        bufferBase64: pdfBuffer.toString('base64'),
        mimeType: format === 'docx'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'application/pdf',
        size: pdfBuffer.length,
        pages: contract.pages,
        optimized: optimize
      },
      message: 'Contract downloaded successfully'
    };
  } catch (error: any) {
    return operationFailed('contracts/management', error);
  }
}

async function deleteContract(tenantId: string, config: any, supabase: any) {
  try {
    const { contractId } = config;

    // Delete contract
    const { error } = await supabase
      .from('contracts')
      .delete()
      .eq('id', contractId)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    return {
      success: true,
      message: 'Contract deleted successfully'
    };
  } catch (error: any) {
    return operationFailed('contracts/management', error);
  }
}

async function sendContract(tenantId: string, config: any, supabase: any, actorUserId: string) {
  try {
    const { contractId, recipients, subject, message, format = 'pdf' } = config;
    if (!contractId || !recipients) {
      return { success: false, error: 'contractId and recipients are required' };
    }

    const { data: contract, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !contract) {
      return { success: false, error: 'Contract not found' };
    }

    const recipientEmail = Array.isArray(recipients)
      ? String(recipients[0] || '').trim().toLowerCase()
      : String(recipients || '').trim().toLowerCase();
    if (!recipientEmail) {
      return { success: false, error: 'At least one recipient email is required' };
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { error: tokenError } = await supabase
      .from('contract_signing_tokens')
      .insert({
        tenant_id: tenantId,
        contract_id: contractId,
        token,
        signer_email: recipientEmail,
        signer_role: 'client',
        expires_at: expiresAt,
        created_by: actorUserId,
        metadata: {
          source: 'contracts_management_send',
          createdAt: new Date().toISOString(),
        },
      });

    if (tokenError) {
      return { success: false, error: 'Failed to create signing link' };
    }

    const signingUrl = AppUrls.signContract(token);

    const generated = await downloadContract(tenantId, { contractId, format, optimize: true }, supabase);
    if (!generated?.success || !generated?.data?.bufferBase64) {
      return { success: false, error: 'Failed to generate contract document' };
    }

    const resolvedProvider = await resolveEmailProviderConfig({
      tenantId,
      preferredUserId: actorUserId,
      fallbackToEnv: true,
    });
    if (!resolvedProvider?.apiKey) {
      return { success: false, error: 'Email service not configured for this account' };
    }

    const emailResult = await sendWithProviderSdk(resolvedProvider.provider as EmailProvider, {
      apiKey: resolvedProvider.apiKey,
      fromEmail: resolvedProvider.fromEmail || process.env.SENDGRID_FROM_EMAIL || process.env.BREVO_FROM_EMAIL || 'onboarding@alphacone.io',
      fromName: resolvedProvider.fromName || 'AlphaClone Systems',
      to: recipients,
      subject: subject || `Contract: ${contract.title}`,
      text: `${message || `Please review and sign the attached contract: ${contract.title}`}\n\nSign securely here: ${signingUrl}\n\nThis link expires in 14 days and is tied to ${recipientEmail}.`,
      attachments: [{
        filename: generated.data.filename || `${String(contract.title || 'contract').replace(/\s+/g, '_')}.${format}`,
        content: generated.data.bufferBase64,
        contentType: generated.data.mimeType || (format === 'docx'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'application/pdf'),
      }],
    });

    if (!emailResult.ok) {
      return { success: false, error: emailResult.error || 'Failed to send contract email' };
    }

    await supabase
      .from('contracts')
      .update({ status: contract.status === 'draft' ? 'sent' : contract.status, updated_at: new Date().toISOString() })
      .eq('id', contractId)
      .eq('tenant_id', tenantId);

    const { runId } = await start(contractLifecycleWorkflow, [{ contractId, tenantId }]);

    return {
      success: true,
      message: 'Contract sent successfully',
      signingUrl,
      runId
    };
  } catch (error: any) {
    return operationFailed('contracts/management', error);
  }
}

async function getTemplates(tenantId: string, supabase: any) {
  try {
    const { data, error } = await supabase
      .from('contract_templates')
      .select('*')
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (error) throw error;
    return { success: true, data: { templates: data || [] } };
  } catch (error: any) {
    return operationFailed('contracts/management', error);
  }
}

async function createTemplate(tenantId: string, config: any, supabase: any, userId: string) {
  try {
    const { data, error } = await supabase
      .from('contract_templates')
      .insert({
        tenant_id: tenantId,
        name: config.name,
        category: config.category || 'service',
        description: config.description,
        content: config.content || '',
        output_format: config.outputFormat || 'html',
        approval_required: config.approvalRequired ?? false,
        is_active: config.isActive ?? true,
        is_default: config.isDefault ?? false,
        version_number: config.versionNumber || 1,
        created_by: userId,
        updated_by: userId,
        metadata: config.metadata || {},
      })
      .select('*')
      .single();

    if (error) throw error;
    return { success: true, data, message: 'Contract template created successfully' };
  } catch (error: any) {
    return operationFailed('contracts/management', error);
  }
}

async function getContractVersions(tenantId: string, config: any, supabase: any) {
  try {
    const { contractId } = config;
    const { data, error } = await supabase
      .from('contract_versions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('contract_id', contractId)
      .order('version_number', { ascending: false });

    if (error) throw error;
    return { success: true, data: { versions: data || [] } };
  } catch (error: any) {
    return operationFailed('contracts/management', error);
  }
}

async function createContractVersion(tenantId: string, config: any, supabase: any, userId: string) {
  try {
    const { contractId, content, changeSummary, status = 'draft' } = config;
    const { data: latest } = await supabase
      .from('contract_versions')
      .select('version_number')
      .eq('tenant_id', tenantId)
      .eq('contract_id', contractId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const versionNumber = Number(latest?.version_number || 0) + 1;
    const { data, error } = await supabase
      .from('contract_versions')
      .insert({
        tenant_id: tenantId,
        contract_id: contractId,
        version_number: versionNumber,
        content,
        status,
        change_summary: changeSummary,
        created_by: userId,
        metadata: config.metadata || {},
      })
      .select('*')
      .single();

    if (error) throw error;
    return { success: true, data, message: 'Contract version created successfully' };
  } catch (error: any) {
    return operationFailed('contracts/management', error);
  }
}

async function requestContractApproval(tenantId: string, config: any, supabase: any, userId: string) {
  try {
    const { data, error } = await supabase
      .from('contract_approvals')
      .insert({
        tenant_id: tenantId,
        contract_id: config.contractId,
        contract_version_id: config.contractVersionId || null,
        requested_by: userId,
        approver_id: config.approverId || null,
        request_note: config.requestNote,
        due_at: config.dueAt || null,
        status: 'pending',
        metadata: config.metadata || {},
      })
      .select('*')
      .single();

    if (error) throw error;

    if (config.contractVersionId) {
      await supabase
        .from('contract_versions')
        .update({ status: 'approval_pending' })
        .eq('id', config.contractVersionId)
        .eq('tenant_id', tenantId);
    }

    return { success: true, data, message: 'Approval requested successfully' };
  } catch (error: any) {
    return operationFailed('contracts/management', error);
  }
}

async function reviewContractApproval(tenantId: string, config: any, supabase: any) {
  try {
    const status = config.status === 'approved' ? 'approved' : config.status === 'cancelled' ? 'cancelled' : 'rejected';
    const { data, error } = await supabase
      .from('contract_approvals')
      .update({
        status,
        decision_note: config.decisionNote,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', config.approvalId)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    if (error) throw error;

    if (data?.contract_version_id) {
      await supabase
        .from('contract_versions')
        .update({ status: status === 'approved' ? 'approved' : 'rejected' })
        .eq('id', data.contract_version_id)
        .eq('tenant_id', tenantId);
    }

    return { success: true, data, message: 'Approval reviewed successfully' };
  } catch (error: any) {
    return operationFailed('contracts/management', error);
  }
}

async function generateAIContractContent(params: any) {
  const { type, parties, terms, duration, payment, pages, fontSize, lineSpacing, template } = params;
  
  let content = '';
  
  // Template-based content generation
  switch (template) {
    case 'professional':
      content = generateProfessionalContract(params);
      break;
    case 'simple':
      content = generateSimpleContract(params);
      break;
    case 'detailed':
      content = generateDetailedContract(params);
      break;
    default:
      content = generateStandardContract(params);
  }
  
  return content;
}

function generateStandardContract(params: any) {
  const { type, parties, terms, duration, payment, fontSize, lineSpacing } = params;
  
  const content = `
    <div style="font-family: 'Noto Sans', 'Noto Sans KR', 'Noto Sans JP', 'Noto Sans SC', 'Noto Naskh Arabic', Arial, sans-serif; font-size: ${fontSize}px; line-height: ${lineSpacing}; max-width: 800px; margin: 0 auto; padding: 40px;">
      
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 40px; border-bottom: 2px solid #333; padding-bottom: 20px;">
        <h1 style="font-size: ${fontSize + 8}px; margin: 0; color: #333;">${type.toUpperCase()} AGREEMENT</h1>
        <p style="font-size: ${fontSize}px; margin: 10px 0 0 0; color: #666;">Effective Date: ${new Date().toLocaleDateString()}</p>
      </div>
      
      <!-- Parties -->
      <div style="margin-bottom: 30px;">
        <h2 style="font-size: ${fontSize + 4}px; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px;">PARTIES</h2>
        ${parties.map((party: any, index: number) => `
          <div style="margin-bottom: 15px;">
            <p style="margin: 0; font-weight: bold;">${index + 1}. ${party.name}</p>
            <p style="margin: 5px 0; color: #666;">${party.address}</p>
            ${party.email ? `<p style="margin: 5px 0; color: #666;">Email: ${party.email}</p>` : ''}
            ${party.phone ? `<p style="margin: 5px 0; color: #666;">Phone: ${party.phone}</p>` : ''}
          </div>
        `).join('')}
      </div>
      
      <!-- Terms -->
      <div style="margin-bottom: 30px;">
        <h2 style="font-size: ${fontSize + 4}px; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px;">TERMS AND CONDITIONS</h2>
        ${terms.map((term: any, index: number) => `
          <div style="margin-bottom: 20px;">
            <p style="margin: 0; font-weight: bold; color: #333;">${index + 1}. ${term.title}</p>
            <p style="margin: 10px 0; color: #666; line-height: ${lineSpacing};">${term.description}</p>
          </div>
        `).join('')}
      </div>
      
      <!-- Duration -->
      <div style="margin-bottom: 30px;">
        <h2 style="font-size: ${fontSize + 4}px; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px;">DURATION</h2>
        <p style="margin: 10px 0; color: #666;">This agreement shall commence on ${duration.startDate} and shall continue until ${duration.endDate} unless terminated earlier in accordance with the terms herein.</p>
      </div>
      
      <!-- Payment -->
      <div style="margin-bottom: 30px;">
        <h2 style="font-size: ${fontSize + 4}px; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px;">PAYMENT TERMS</h2>
        <p style="margin: 10px 0; color: #666;"><strong>Amount:</strong> ${payment.amount} ${payment.currency}</p>
        <p style="margin: 10px 0; color: #666;"><strong>Payment Schedule:</strong> ${payment.schedule}</p>
        <p style="margin: 10px 0; color: #666;"><strong>Payment Method:</strong> ${payment.method}</p>
        <p style="margin: 10px 0; color: #666;"><strong>Due Date:</strong> ${payment.dueDate}</p>
      </div>
      
      <!-- Signatures -->
      <div style="margin-top: 60px; page-break-inside: avoid;">
        <div style="display: flex; justify-content: space-between;">
          <div style="width: 45%;">
            <p style="margin: 0; font-weight: bold;">Party 1 Signature</p>
            <div style="border-bottom: 1px solid #333; margin: 20px 0; height: 40px;"></div>
            <p style="margin: 5px 0; color: #666;">Name: ${parties[0]?.name || ''}</p>
            <p style="margin: 5px 0; color: #666;">Date: _______________</p>
          </div>
          <div style="width: 45%;">
            <p style="margin: 0; font-weight: bold;">Party 2 Signature</p>
            <div style="border-bottom: 1px solid #333; margin: 20px 0; height: 40px;"></div>
            <p style="margin: 5px 0; color: #666;">Name: ${parties[1]?.name || ''}</p>
            <p style="margin: 5px 0; color: #666;">Date: _______________</p>
          </div>
        </div>
      </div>
      
    </div>
  `;

  return wrapContractHtmlDocument(content, fontSize, lineSpacing);
}

function generateProfessionalContract(params: any) {
  // Similar to standard but with more professional styling
  return generateStandardContract(params);
}

function generateSimpleContract(params: any) {
  // Simplified version with less legal jargon
  return generateStandardContract(params);
}

function generateDetailedContract(params: any) {
  // More detailed version with additional clauses
  return generateStandardContract(params);
}

function wrapContractHtmlDocument(content: string, fontSize: number, lineSpacing: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Noto+Sans+KR:wght@400;700&family=Noto+Sans+JP:wght@400;700&family=Noto+Sans+SC:wght@400;700&family=Noto+Naskh+Arabic:wght@400;700&display=swap" rel="stylesheet">
  <style>
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #111827;
      font-family: 'Noto Sans', 'Noto Sans KR', 'Noto Sans JP', 'Noto Sans SC', 'Noto Naskh Arabic', Arial, sans-serif;
      font-size: ${fontSize}px;
      line-height: ${lineSpacing};
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }
    * {
      box-sizing: border-box;
      font-family: inherit;
    }
    @media print {
      html, body {
        font-family: 'Noto Sans', 'Noto Sans KR', 'Noto Sans JP', 'Noto Sans SC', 'Noto Naskh Arabic', Arial, sans-serif !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
${content}
</body>
</html>`;
}

async function generateOptimizedContractPDF(params: any) {
  const { content, fontSize, lineSpacing, targetPages, format, optimize, template } = params;
  
  if (format === 'pdf') {
    const optimizedContent = optimizeContentForPDF(content, targetPages, fontSize, lineSpacing, optimize);
    return renderContractPdfBuffer(optimizedContent);
  } else if (format === 'docx') {
    return generateDOCXFromContent(content, targetPages, fontSize, lineSpacing);
  } else {
    return generateOptimizedContractPDF({ ...params, format: 'pdf' });
  }
}

function optimizeContentForPDF(content: string, targetPages: number, fontSize: number, lineSpacing: number, optimize: boolean) {
  const normalizedContent = normalizeLegalContractText(content);
  const printableHtml = ensurePrintableContractHtml(normalizedContent, fontSize, lineSpacing);
  if (!optimize) return printableHtml;
  
  // Calculate optimal content distribution
  const contentLength = printableHtml.length;
  const charactersPerPage = Math.floor(contentLength / targetPages);
  
  // Adjust spacing and font size for optimal layout
  const adjustedFontSize = fontSize * (targetPages <= 2 ? 1.1 : 1);
  const adjustedLineSpacing = lineSpacing * (targetPages <= 2 ? 1.1 : 1);
  
  // Apply optimizations
  let optimizedContent = printableHtml
    .replace(/font-size:\s*\d+px/g, `font-size: ${adjustedFontSize}px`)
    .replace(/line-height:\s*[\d.]+/g, `line-height: ${adjustedLineSpacing}`);
  
  return optimizedContent;
}

function ensurePrintableContractHtml(content: string, fontSize: number, lineSpacing: number): string {
  const raw = String(content || '');
  const hasHtmlTag = /<\/?(html|head|body|div|section|article|p|h1|h2|h3|table)\b/i.test(raw);
  if (hasHtmlTag) return raw;

  const normalized = raw
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+(?=\d+\.\s*[A-Z][A-Z\s/&'":\-]{3,})/g, '\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const blocks = normalized
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean);

  const body = blocks
    .map((line) => {
      const escaped = escapeHtml(line);
      if (/^\d+(\.\d+)?\s+[A-Z][A-Z\s/&'":\-]{3,}$/.test(line)) {
        return `<h2>${escaped}</h2>`;
      }
      return `<p>${escaped}</p>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      font-family: Arial, Helvetica, sans-serif;
      font-size: ${fontSize}px;
      line-height: ${lineSpacing};
    }
    body { padding: 24px; }
    h2 {
      margin: 18px 0 8px 0;
      font-size: ${Math.max(fontSize + 2, 14)}px;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
    }
    p {
      margin: 0 0 10px 0;
      white-space: pre-wrap;
      word-break: break-word;
      text-align: justify;
    }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

function normalizeLegalContractText(content: string): string {
  const raw = String(content || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!raw) return '';

  const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
  const output: string[] = [];
  let sectionCounter = 0;
  let clauseCounter = 0;

  const headingPattern = /^((section|article)\s+)?(\d+(\.\d+)*)?[\)\.\-:]?\s*([A-Z][A-Z0-9\s/&'":,\-()]{3,})$/i;

  for (const line of lines) {
    const isHeading = headingPattern.test(line) || /^#{1,3}\s+/.test(line);
    if (isHeading) {
      const headingText = line
        .replace(/^#{1,3}\s+/, '')
        .replace(/^(section|article)\s+/i, '')
        .replace(/^\d+(\.\d+)*[\)\.\-:]?\s*/, '')
        .trim()
        .toUpperCase();
      sectionCounter += 1;
      clauseCounter = 0;
      output.push(`${sectionCounter}.0 ${headingText}`);
      continue;
    }

    if (sectionCounter === 0) {
      sectionCounter = 1;
      output.push('1.0 GENERAL TERMS');
      clauseCounter = 0;
    }
    clauseCounter += 1;
    output.push(`${sectionCounter}.${clauseCounter} ${line}`);
  }

  return output.join('\n\n');
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function renderContractPdfBuffer(html: string): Promise<Buffer> {
  const { page, close } = await BrowserManager.createPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="width:100%;font-size:9px;color:#64748b;padding:0 20px;">
          <span style="float:left;">AlphaClone Systems Contract</span>
          <span style="float:right;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `,
      margin: {
        top: '25.4mm',
        right: '25.4mm',
        bottom: '25.4mm',
        left: '25.4mm',
      },
    });
    return Buffer.from(pdf);
  } finally {
    await close().catch(() => undefined);
  }
}

function normalizeTextBlocks(content: string): string[] {
  const plain = String(content || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return plain.split('\n').map((line) => line.trim()).filter(Boolean);
}

async function generateDOCXFromContent(content: string, _pages: number, fontSize: number, lineSpacing: number) {
  const normalizedContent = normalizeLegalContractText(content);
  const blocks = normalizeTextBlocks(normalizedContent);
  const paragraphSpacing = Math.round((lineSpacing - 1) * 240);
  const baseSize = Math.max(20, Math.round((fontSize / 12) * 24));

  const children = blocks.map((line) => {
    const isPrimaryHeading = /^(\d+(\.\d+)*)\s+[A-Z][A-Z0-9\s/&'":,\-()]{3,}$/.test(line);
    const isHashHeading = /^#{1,3}\s+/.test(line);
    if (isPrimaryHeading || isHashHeading) {
      const headingText = line.replace(/^#{1,3}\s+/, '');
      return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
        children: [new TextRun({ text: headingText, bold: true })],
      });
    }

    return new Paragraph({
      spacing: { before: 0, after: Math.max(80, paragraphSpacing) },
      alignment: AlignmentType.JUSTIFIED,
      children: [new TextRun({ text: line, size: baseSize })],
    });
  });

  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: baseSize } } },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun('Page '),
                new TextRun({ children: [PageNumber.CURRENT] }),
              ],
            }),
          ],
        }),
      },
      children: children.length > 0 ? children : [new Paragraph('Contract content unavailable.')],
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
