import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { operationFailed } from '@/lib/api/operationResult';
import { BrowserManager } from '@/lib/scraper/browserManager';

function isSocialPublishEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.SOCIAL_PUBLISH_ENABLED === 'true';
}

export async function POST(req: NextRequest) {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { tenantId, action, config } = await req.json();

    if (!tenantId || !action) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    if (action === 'create_post' && !isSocialPublishEnabled()) {
      return NextResponse.json({ error: 'Publishing disabled' }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();
    await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

    switch (action) {
      case 'create_post':
        return NextResponse.json(await createFacebookPost(tenantId, config, supabase));
      case 'manage_page':
        return NextResponse.json(await manageFacebookPage(tenantId, config, supabase));
      case 'generate_contract':
        return NextResponse.json(await generateContract(tenantId, config, supabase));
      case 'update_contract':
        return NextResponse.json(await updateContract(tenantId, config, supabase));
      case 'download_contract':
        return NextResponse.json(await downloadContract(tenantId, config, supabase));
      default:
        return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('Facebook management error:', error);
    return clientErrorResponse(error, { request: req, scope: 'facebook/management.POST' });
  }
}

async function createFacebookPost(tenantId: string, config: any, supabase: any) {
  try {
    const { pageId, message, imageUrl, link, scheduledTime } = config;

    // Get Facebook integration
    const { data: integration, error } = await supabase
      .from('facebook_integrations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (error || !integration) {
      return { success: false, error: 'Facebook integration not found' };
    }

    // Create post content
    const postContent = {
      message: message,
      link: link || undefined,
      picture: imageUrl || undefined,
      published: !scheduledTime,
      scheduled_publish_time: scheduledTime || undefined
    };

    // Make API call to Facebook
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}/feed?access_token=${integration.page_access_token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postContent)
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('[facebook/management] create post Graph error:', result.error);
      return { success: false, error: 'Failed to create post' };
    }

    // Save post to database
    await supabase.from('facebook_posts').insert({
      tenant_id: tenantId,
      page_id: pageId,
      post_id: result.id,
      message: message,
      image_url: imageUrl,
      link: link,
      scheduled_time: scheduledTime,
      status: scheduledTime ? 'scheduled' : 'published',
      created_at: new Date().toISOString()
    });

    return {
      success: true,
      data: result,
      message: scheduledTime ? 'Post scheduled successfully' : 'Post published successfully'
    };
  } catch (error: any) {
    return operationFailed('facebook/management', error);
  }
}

async function manageFacebookPage(tenantId: string, config: any, supabase: any) {
  try {
    const { pageId, action: pageAction, pageData } = config;

    // Get Facebook integration
    const { data: integration, error } = await supabase
      .from('facebook_integrations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (error || !integration) {
      return { success: false, error: 'Facebook integration not found' };
    }

    let result;

    switch (pageAction) {
      case 'get_page_info':
        // Get page information
        const pageInfoResponse = await fetch(
          `https://graph.facebook.com/v18.0/${pageId}?access_token=${integration.page_access_token}&fields=id,name,username,followers_count,talking_about_count,website,phone,about,category`
        );
        result = await pageInfoResponse.json();
        break;

      case 'update_page_info':
        // Update page information
        const updateResponse = await fetch(
          `https://graph.facebook.com/v18.0/${pageId}?access_token=${integration.page_access_token}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pageData)
          }
        );
        result = await updateResponse.json();
        break;

      case 'get_page_insights':
        // Get page insights
        const insightsResponse = await fetch(
          `https://graph.facebook.com/v18.0/${pageId}/insights?access_token=${integration.page_access_token}&metric=page_impressions,page_engaged_users,page_fan_adds,page_fan_removes&period=day`
        );
        result = await insightsResponse.json();
        break;

      case 'get_posts':
        // Get page posts
        const postsResponse = await fetch(
          `https://graph.facebook.com/v18.0/${pageId}/posts?access_token=${integration.page_access_token}&fields=id,message,created_time,likes.summary(true),comments.summary(true),shares&limit=10`
        );
        result = await postsResponse.json();
        break;

      default:
        return { success: false, error: 'Unsupported page action' };
    }

    return {
      success: true,
      data: result,
      message: `Page ${pageAction} completed successfully`
    };
  } catch (error: any) {
    return operationFailed('facebook/management', error);
  }
}

async function generateContract(tenantId: string, config: any, supabase: any) {
  try {
    const { 
      contractType, 
      parties, 
      terms, 
      duration, 
      payment, 
      pages = 2, // Default to 2 pages
      fontSize = 12, // Default font size
      spacing = 1.2 // Default line spacing
    } = config;

    // Generate contract content with AI
    const contractContent = await generateContractContent({
      contractType,
      parties,
      terms,
      duration,
      payment,
      pages,
      fontSize,
      spacing
    });

    // Save contract to database
    const { data: contract, error } = await supabase
      .from('contracts')
      .insert({
        tenant_id: tenantId,
        type: contractType,
        title: `${contractType} Agreement`,
        content: contractContent,
        parties: parties,
        terms: terms,
        duration: duration,
        payment: payment,
        pages: pages,
        font_size: fontSize,
        line_spacing: spacing,
        status: 'draft',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data: contract,
      message: 'Contract generated successfully'
    };
  } catch (error: any) {
    return operationFailed('facebook/management', error);
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
    return operationFailed('facebook/management', error);
  }
}

async function downloadContract(tenantId: string, config: any, supabase: any) {
  try {
    const { contractId, format = 'pdf' } = config;

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

    // Generate optimized PDF with proper page management
    const pdfBuffer = await generateOptimizedPDF({
      content: contract.content,
      fontSize: contract.font_size || 12,
      lineSpacing: contract.line_spacing || 1.2,
      targetPages: contract.pages || 2,
      format: format
    });

    return {
      success: true,
      data: {
        filename: `${contract.title.replace(/\s+/g, '_')}.${format}`,
        bufferBase64: pdfBuffer.toString('base64'),
        mimeType: 'application/pdf',
        size: pdfBuffer.length
      },
      message: 'Contract downloaded successfully'
    };
  } catch (error: any) {
    return operationFailed('facebook/management', error);
  }
}

async function generateContractContent(params: any) {
  // AI-powered contract generation
  const { contractType, parties, terms, duration, payment, pages, fontSize, spacing } = params;
  
  let content = '';
  
  // Header
  content += `<div style="font-family: 'Segoe UI', Arial, sans-serif; font-size: ${fontSize + 4}px; line-height: ${spacing}; text-align: center; margin-bottom: 30px;">
    <h1><strong>${contractType} AGREEMENT</strong></h1>
    <p style="font-size: ${fontSize}px; margin-top: 10px;">Effective Date: ${new Date().toLocaleDateString()}</p>
  </div>`;
  
  // Parties
  content += `<div style="font-size: ${fontSize}px; line-height: ${spacing}; margin-bottom: 20px;">
    <h2 style="font-size: ${fontSize + 2}px;"><strong>PARTIES</strong></h2>`;
  
  parties.forEach((party: any, index: number) => {
    content += `<p style="margin-bottom: 10px;">
      <strong>${index + 1}. ${party.name}</strong><br>
      ${party.address}<br>
      ${party.email ? `Email: ${party.email}<br>` : ''}
      ${party.phone ? `Phone: ${party.phone}` : ''}
    </p>`;
  });
  
  content += `</div>`;
  
  // Terms and Conditions
  content += `<div style="font-size: ${fontSize}px; line-height: ${spacing}; margin-bottom: 20px;">
    <h2 style="font-size: ${fontSize + 2}px;"><strong>TERMS AND CONDITIONS</strong></h2>`;
  
  terms.forEach((term: any, index: number) => {
    content += `<p style="margin-bottom: 15px;">
      <strong>${index + 1}. ${term.title}</strong><br>
      ${term.description}
    </p>`;
  });
  
  content += `</div>`;
  
  // Duration
  content += `<div style="font-size: ${fontSize}px; line-height: ${spacing}; margin-bottom: 20px;">
    <h2 style="font-size: ${fontSize + 2}px;"><strong>DURATION</strong></h2>
    <p>This agreement shall commence on ${duration.startDate} and shall continue until ${duration.endDate} unless terminated earlier in accordance with the terms herein.</p>
  </div>`;
  
  // Payment Terms
  content += `<div style="font-size: ${fontSize}px; line-height: ${spacing}; margin-bottom: 20px;">
    <h2 style="font-size: ${fontSize + 2}px;"><strong>PAYMENT TERMS</strong></h2>
    <p><strong>Amount:</strong> ${payment.amount} ${payment.currency}</p>
    <p><strong>Payment Schedule:</strong> ${payment.schedule}</p>
    <p><strong>Payment Method:</strong> ${payment.method}</p>
    <p><strong>Due Date:</strong> ${payment.dueDate}</p>
  </div>`;
  
  // Signatures
  content += `<div style="font-size: ${fontSize}px; line-height: ${spacing}; margin-top: 50px;">
    <div style="display: flex; justify-content: space-between;">
      <div style="width: 45%;">
        <p><strong>Party 1 Signature</strong></p>
        <p>_________________________</p>
        <p>Name: ${parties[0]?.name || ''}</p>
        <p>Date: _______________</p>
      </div>
      <div style="width: 45%;">
        <p><strong>Party 2 Signature</strong></p>
        <p>_________________________</p>
        <p>Name: ${parties[1]?.name || ''}</p>
        <p>Date: _______________</p>
      </div>
    </div>
  </div>`;
  
  return content;
}

async function generateOptimizedPDF(params: any) {
  const { content, fontSize, lineSpacing, targetPages, format } = params;
  const html = wrapFacebookContractHtml(content, fontSize, lineSpacing);
  const { page, close } = await BrowserManager.createPage();
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
    await close().catch(() => undefined);
  }
}

function wrapFacebookContractHtml(content: string, fontSize: number, lineSpacing: number): string {
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
