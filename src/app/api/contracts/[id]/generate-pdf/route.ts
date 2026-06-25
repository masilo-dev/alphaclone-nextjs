import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { generateContractPDF } from '@/utils/pdfGenerator';
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

        // 2. Fetch tenant for branding
        const { data: tenant } = await admin
            .from('tenants')
            .select('*')
            .eq('id', tenantId)
            .single();

        const doc = generateContractPDF(
            {
                id: contract.id,
                title: contract.title,
                status: contract.status,
                content: contract.content,
                signed_at: contract.signed_at,
                signer_name: contract.signer_name,
                signer_email: contract.signer_email,
                created_at: contract.created_at,
            },
            tenant as any
        );
        const pdfContent = Buffer.from(doc.output('arraybuffer'));

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
