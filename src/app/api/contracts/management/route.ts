import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { operationFailed } from '@/lib/api/operationResult';
import { BrowserManager } from '@/lib/scraper/browserManager';

export async function POST(req: NextRequest) {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { tenantId, action, config } = await req.json();

    if (!tenantId || !action) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

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
      case 'delete_contract':
        return NextResponse.json(await deleteContract(tenantId, config, supabase));
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
  const printableHtml = ensurePrintableContractHtml(content, fontSize, lineSpacing);
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

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function renderContractPdfBuffer(html: string): Promise<Buffer> {
  const { page } = await BrowserManager.createPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
    });
    return Buffer.from(pdf);
  } finally {
    await page.context().close().catch(() => undefined);
  }
}

function generateDOCXFromContent(content: string, pages: number, fontSize: number, lineSpacing: number) {
  // Mock DOCX generation
  return Buffer.from(`PK[MOCK DOCX CONTENT FOR ${pages} PAGES]`);
}
