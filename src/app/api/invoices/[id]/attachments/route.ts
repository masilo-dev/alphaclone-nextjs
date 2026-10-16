import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import {
  ensureInvoiceDocumentsBucket,
  INVOICE_DOCUMENTS_BUCKET,
  type InvoiceAttachmentItem,
} from '@/lib/invoices/invoiceLifecycleSteps';

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/csv',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120);
  return cleaned || 'attachment';
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await context.params;
    const contentTypeHeader = req.headers.get('content-type') || '';

    let tenantId = '';
    let fileName = '';
    let mimeType = 'application/octet-stream';
    let buffer: Buffer;

    if (contentTypeHeader.includes('multipart/form-data')) {
      const formData = await req.formData();
      tenantId = String(formData.get('tenantId') || '').trim();
      const file = formData.get('file');
      if (!file || typeof file === 'string') {
        return NextResponse.json({ error: 'Attachment file is required' }, { status: 400 });
      }
      fileName = file.name || 'attachment';
      mimeType = file.type || 'application/octet-stream';
      buffer = Buffer.from(await file.arrayBuffer());
    } else {
      const body = await req.json().catch(() => ({}));
      tenantId = String(body.tenantId || '').trim();
      fileName = String(body.fileName || body.name || '').trim();
      mimeType = String(body.contentType || 'application/pdf').trim();
      const base64 = String(body.base64Content || body.content || '').replace(/^data:[^;]+;base64,/, '').trim();
      if (!base64) {
        return NextResponse.json({ error: 'Attachment content is required' }, { status: 400 });
      }
      buffer = Buffer.from(base64, 'base64');
    }

    if (!isUuid(tenantId)) {
      return NextResponse.json({ error: 'Valid tenantId is required' }, { status: 400 });
    }

    if (buffer.byteLength === 0) {
      return NextResponse.json({ error: 'Attachment file cannot be empty' }, { status: 400 });
    }

    if (buffer.byteLength > MAX_ATTACHMENT_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Attachment exceeds the 10 MB maximum file size limit' },
        { status: 413 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: `Unsupported file type (${mimeType}). Allowed: PDF, PNG, JPG, WEBP, CSV, TXT, DOC/DOCX, XLS/XLSX.` },
        { status: 415 }
      );
    }

    const { admin } = await requireTenantAccess(tenantId, req);
    await ensureInvoiceDocumentsBucket(admin);

    let existingInvoice: Record<string, any> | null = null;
    if (invoiceId !== 'draft') {
      if (!isUuid(invoiceId)) {
        return NextResponse.json({ error: 'Valid invoice ID is required' }, { status: 400 });
      }
      const { data: inv, error: invErr } = await admin
        .from('business_invoices')
        .select('id, tenant_id, metadata')
        .eq('id', invoiceId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (invErr || !inv) {
        return NextResponse.json({ error: 'Invoice not found in this workspace' }, { status: 404 });
      }
      existingInvoice = inv;
    }

    const safeName = sanitizeFilename(fileName);
    const folder = invoiceId === 'draft' ? 'drafts' : invoiceId;
    const storagePath = `tenant/${tenantId}/invoices/${folder}/attachments/${Date.now()}-${safeName}`;

    const { error: uploadError } = await admin.storage
      .from(INVOICE_DOCUMENTS_BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Failed to upload attachment: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const attachment: InvoiceAttachmentItem = {
      name: fileName || safeName,
      storagePath,
      contentType: mimeType,
      size: buffer.byteLength,
    };

    if (existingInvoice) {
      const meta = ((existingInvoice.metadata && typeof existingInvoice.metadata === 'object')
        ? existingInvoice.metadata
        : {}) as Record<string, unknown>;
      const prevAttachments = Array.isArray(meta.attachments)
        ? (meta.attachments as InvoiceAttachmentItem[])
        : [];
      const nextAttachments = [...prevAttachments, attachment];

      await admin
        .from('business_invoices')
        .update({
          metadata: {
            ...meta,
            attachments: nextAttachments,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId)
        .eq('tenant_id', tenantId);
    }

    return NextResponse.json({ success: true, attachment }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to upload invoice attachment', req);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const tenantId = String(body.tenantId || '').trim();
    const storagePath = String(body.storagePath || '').trim();

    if (!isUuid(tenantId) || !storagePath) {
      return NextResponse.json({ error: 'Valid tenantId and storagePath are required' }, { status: 400 });
    }

    if (!storagePath.startsWith(`tenant/${tenantId}/`)) {
      return NextResponse.json({ error: 'Forbidden attachment path' }, { status: 403 });
    }

    const { admin } = await requireTenantAccess(tenantId, req);

    await admin.storage
      .from(INVOICE_DOCUMENTS_BUCKET)
      .remove([storagePath])
      .catch(() => undefined);

    if (invoiceId !== 'draft' && isUuid(invoiceId)) {
      const { data: existingInvoice } = await admin
        .from('business_invoices')
        .select('id, metadata')
        .eq('id', invoiceId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (existingInvoice) {
        const meta = ((existingInvoice.metadata && typeof existingInvoice.metadata === 'object')
          ? existingInvoice.metadata
          : {}) as Record<string, unknown>;
        const prevAttachments = Array.isArray(meta.attachments)
          ? (meta.attachments as InvoiceAttachmentItem[])
          : [];
        const nextAttachments = prevAttachments.filter((a) => a.storagePath !== storagePath);

        await admin
          .from('business_invoices')
          .update({
            metadata: {
              ...meta,
              attachments: nextAttachments,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoiceId)
          .eq('tenant_id', tenantId);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to remove invoice attachment', req);
  }
}
