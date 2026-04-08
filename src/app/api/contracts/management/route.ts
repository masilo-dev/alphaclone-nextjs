import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase-server';

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
  } catch (error: any) {
    console.error('Contract management error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
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
    return { success: false, error: error.message };
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
    return { success: false, error: error.message };
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
    return { success: false, error: error.message };
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
        buffer: pdfBuffer,
        size: pdfBuffer.length,
        pages: contract.pages,
        optimized: optimize
      },
      message: 'Contract downloaded successfully'
    };
  } catch (error: any) {
    return { success: false, error: error.message };
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
    return { success: false, error: error.message };
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
  
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; font-size: ${fontSize}px; line-height: ${lineSpacing}; max-width: 800px; margin: 0 auto; padding: 40px;">
      
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

async function generateOptimizedContractPDF(params: any) {
  const { content, fontSize, lineSpacing, targetPages, format, optimize, template } = params;
  
  if (format === 'pdf') {
    // Generate optimized PDF
    const optimizedContent = optimizeContentForPDF(content, targetPages, fontSize, lineSpacing, optimize);
    
    // This would use a PDF library like puppeteer or jsPDF
    // For now, return a mock buffer
    const pdfContent = generatePDFFromHTML(optimizedContent, targetPages);
    
    return Buffer.from(pdfContent);
  } else if (format === 'docx') {
    // Generate DOCX format
    return generateDOCXFromContent(content, targetPages, fontSize, lineSpacing);
  } else {
    // Default to PDF
    return generateOptimizedContractPDF({ ...params, format: 'pdf' });
  }
}

function optimizeContentForPDF(content: string, targetPages: number, fontSize: number, lineSpacing: number, optimize: boolean) {
  if (!optimize) return content;
  
  // Calculate optimal content distribution
  const contentLength = content.length;
  const charactersPerPage = Math.floor(contentLength / targetPages);
  
  // Adjust spacing and font size for optimal layout
  const adjustedFontSize = fontSize * (targetPages <= 2 ? 1.1 : 1);
  const adjustedLineSpacing = lineSpacing * (targetPages <= 2 ? 1.1 : 1);
  
  // Apply optimizations
  let optimizedContent = content
    .replace(/font-size:\s*\d+px/g, `font-size: ${adjustedFontSize}px`)
    .replace(/line-height:\s*[\d.]+/g, `line-height: ${adjustedLineSpacing}`);
  
  return optimizedContent;
}

function generatePDFFromHTML(content: string, pages: number) {
  // Mock PDF generation - in production, use puppeteer or similar
  const pdfHeader = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [`;
  
  const pageObjects = [];
  for (let i = 0; i < pages; i++) {
    pageObjects.push(`${3 + i} 0 R`);
  }
  
  const pdfMiddle = `] /Count ${pages} >>
endobj`;
  
  let pageContent = '';
  for (let i = 0; i < pages; i++) {
    pageContent += `
${3 + i} 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${4 + i} 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj

${4 + i} 0 obj
<< /Length ${content.length} >>
stream
${content}
endstream
endobj`;
  }
  
  const pdfFooter = `
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj

xref
0 ${6 + pages * 2}
0000000000 65535 f`;
  
  let xref = '';
  let offset = 0;
  for (let i = 1; i <= 5 + pages * 2; i++) {
    xref += `\n${offset.toString().padStart(10, '0')} 00000 n`;
    offset += 100; // Mock offset
  }
  
  const pdfTrailer = `
trailer
<< /Size ${6 + pages * 2} /Root 1 0 R >>
startxref
${offset}
%%EOF`;
  
  return Buffer.from(pdfHeader + pageObjects.join(' ') + pdfMiddle + pageContent + pdfFooter + xref + pdfTrailer);
}

function generateDOCXFromContent(content: string, pages: number, fontSize: number, lineSpacing: number) {
  // Mock DOCX generation
  return Buffer.from(`PK[MOCK DOCX CONTENT FOR ${pages} PAGES]`);
}
