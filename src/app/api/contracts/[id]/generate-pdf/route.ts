import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { generateThemedContractPdfBuffer } from '@/lib/documents/themedDocumentPdf';
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
        const { user, admin } = await requireTenantAccess(tenantId, req);

        const { data: contract, error: fetchError } = await admin
            .from('contracts')
            .select('*')
            .eq('id', id)
            .eq('tenant_id', tenantId)
            .single();

        if (fetchError || !contract) {
            return NextResponse.json({ error: 'Contract not found', code: 'NOT_FOUND' }, { status: 404 });
        }

        const { data: tenant } = await admin
            .from('tenants')
            .select('name, logo_url, settings')
            .eq('id', tenantId)
            .single();

        let client: { name?: string; email?: string } | undefined;
        if (contract.client_id) {
            const { data: clientRow } = await admin
                .from('business_clients')
                .select('name, email')
                .eq('id', contract.client_id)
                .maybeSingle();
            if (clientRow) client = { name: clientRow.name, email: clientRow.email };
        }

        const pdfContent = await generateThemedContractPdfBuffer(contract, tenant, client);

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

        const { data: publicUrlData } = admin.storage
            .from('contracts')
            .getPublicUrl(filePath);

        const pdfUrl = publicUrlData?.publicUrl || '';

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
            console.error('Failed to insert document record:', docError);
        }

        return NextResponse.json({ success: true, pdf_url: pdfUrl });
    } catch (error) {
        return routeErrorResponse(error, 'Failed to generate PDF', req);
    }
}
