import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { z } from 'zod';

const generatePdfSchema = z.object({
    tenantId: z.string().uuid(),
});

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const body = await req.json();
        const parsed = generatePdfSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
        }

        const { tenantId } = parsed.data;
        const { user } = await requireTenantAccess(tenantId);
        const admin = createAdminSupabaseClientOrThrow();

        // 1. Fetch contract
        const { data: contract, error: fetchError } = await admin
            .from('contracts')
            .select('*')
            .eq('id', id)
            .eq('tenant_id', tenantId)
            .single();

        if (fetchError || !contract) {
            return NextResponse.json({ error: 'Contract not found', code: 'NOT_FOUND' }, { status: 404 });
        }

        // 2. Generate PDF content (simple HTML-to-PDF via puppeteer or @react-pdf/renderer)
        // For now, we'll create a simple text-based PDF using a basic approach
        // In production, use a proper PDF library like puppeteer or @react-pdf/renderer
        const pdfContent = generateSimplePdf(contract);

        // 3. Upload to Supabase storage
        const fileName = `${contract.id}.pdf`;
        const filePath = `contracts/${tenantId}/${fileName}`;

        const { error: uploadError } = await admin.storage
            .from('contracts')
            .upload(filePath, pdfContent, {
                contentType: 'application/pdf',
                upsert: true,
            });

        if (uploadError) {
            throw new Error(`Failed to upload PDF: ${uploadError.message}`);
        }

        // 4. Get public URL
        const { data: publicUrlData } = admin.storage
            .from('contracts')
            .getPublicUrl(filePath);

        const pdfUrl = publicUrlData?.publicUrl || '';

        // 5. Update contract with pdf_url
        const { error: updateError } = await admin
            .from('contracts')
            .update({
                pdf_url: pdfUrl,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .eq('tenant_id', tenantId);

        if (updateError) {
            throw new Error(`Failed to update contract with pdf_url: ${updateError.message}`);
        }

        // 6. Also insert into documents table for document hub
        const { error: docError } = await admin
            .from('documents')
            .insert({
                tenant_id: tenantId,
                original_filename: `${contract.title || 'Contract'}.pdf`,
                file_type: 'application/pdf',
                category: 'Contract',
                entity_type: 'contract',
                entity_id: id,
                storage_path: filePath,
                scan_status: 'clean',
                created_by: user.id,
            });

        if (docError) {
            // Non-blocking: log but don't fail
            console.error('Failed to insert document record:', docError);
        }

        return NextResponse.json({ success: true, pdf_url: pdfUrl });
    } catch (error) {
        return routeErrorResponse(error, 'Failed to generate PDF', req);
    }
}

function generateSimplePdf(contract: any): Buffer {
    // Simple PDF generation using basic text layout
    // In production, use @react-pdf/renderer or puppeteer
    const content = `
        Contract: ${contract.title || 'Agreement'}
        Status: ${contract.status}
        Signed at: ${contract.signed_at || 'Not signed'}
        Signer: ${contract.signer_name || 'N/A'}
        Signer Email: ${contract.signer_email || 'N/A'}
        
        --- Contract Content ---
        ${contract.content || 'No content available'}
    `;

    // Create a minimal PDF using PDFKit-like approach
    // For now, return a simple text buffer (placeholder)
    // In production, use a proper PDF library
    const pdfBuffer = Buffer.from(content, 'utf-8');
    return pdfBuffer;
}
