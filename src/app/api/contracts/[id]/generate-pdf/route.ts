import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { generateThemedContractPdfBuffer } from '@/lib/documents/themedDocumentPdf';
import { fileContractPdfDocument } from '@/lib/documents/fileDocument';
import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';

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

        const isExecuted = ['client_signed', 'fully_signed', 'signed', 'completed'].includes(contract.status);
        if (isExecuted && contract.pdf_url) {
            return NextResponse.json({
                success: true,
                pdfUrl: contract.pdf_url,
                message: 'Executed agreement uses recorded original PDF',
            });
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
                .eq('tenant_id', tenantId)
                .maybeSingle();
            if (clientRow) client = { name: clientRow.name, email: clientRow.email };
        }

        const pdfContent = await generateThemedContractPdfBuffer(contract, tenant, client);

        const filePath = `tenant/${tenantId}/contracts/${contract.id}/${randomUUID()}.pdf`;

        const { error: uploadError } = await admin.storage
            .from('uploads')
            .upload(filePath, pdfContent, {
                contentType: 'application/pdf',
                upsert: false,
            });

        if (uploadError) {
            throw new Error(`Failed to upload PDF: ${uploadError.message}`);
        }

        const pdfUrl = `/api/storage/uploads/${filePath}`;

        let updateQuery = admin
            .from('contracts')
            .update({
                pdf_url: pdfUrl,
                metadata: { ...contract.metadata, pdf_path: filePath, storage_bucket: 'uploads', pdf_sha256: createHash('sha256').update(pdfContent).digest('hex') },
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .eq('tenant_id', tenantId)
            .eq('status', contract.status);

        if (!isExecuted) {
            updateQuery = updateQuery
                .is('client_signed_at', null)
                .filter('admin_signed_at', contract.admin_signed_at ? 'eq' : 'is', contract.admin_signed_at || null);
        }

        const { data: recordedPdf, error: updateError } = await updateQuery
            .select('id')
            .maybeSingle();

        if (!updateError && !recordedPdf) {
            return NextResponse.json({ error: 'The agreement changed during export. Use its current recorded PDF.', code: 'CONTRACT_CHANGED' }, { status: 409 });
        }
        if (updateError) {
            throw new Error(`Failed to update contract with pdf_url: ${updateError.message}`);
        }

        await fileContractPdfDocument(admin, {
            tenantId,
            userId: user.id,
            contract: {
                id: contract.id,
                title: contract.title,
                client_id: contract.client_id,
                project_id: contract.project_id,
                document_id: contract.document_id,
                status: contract.status,
            },
            storagePath: filePath,
            storageBucket: 'uploads',
            sizeBytes: pdfContent.byteLength,
        }).catch((err) => console.error('[contracts/generate-pdf] catalog filing failed', err));

        return NextResponse.json({ success: true, pdf_url: pdfUrl });
    } catch (error) {
        return routeErrorResponse(error, 'Failed to generate PDF', req);
    }
}
