import { createHash } from 'node:crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { tenantStoragePath } from '@/lib/tenant/platformTenant';

export type ContractAuditTrailInput = {
  tenantId: string;
  contractId: string;
  title: string;
  contentHash: string;
  status: string;
};

/**
 * Generate an eIDAS/ESIGN-oriented PDF audit trail for a fully signed contract.
 * Stores under tenant-prefixed private storage and records the path on the contract.
 */
export async function generateContractAuditTrailPdf(
  input: ContractAuditTrailInput
): Promise<{ storagePath: string; documentHash: string } | null> {
  const admin = createSupabaseAdminClient();

  const { data: events, error } = await admin
    .from('contract_audit_trail')
    .select(
      'action, actor_name, actor_email, actor_role, ip_address, user_agent, details, created_at'
    )
    .eq('contract_id', input.contractId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[contract-audit-pdf] trail fetch failed:', error.message);
    return null;
  }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([612, 792]);
  let y = 750;

  const draw = (text: string, opts?: { size?: number; bold?: boolean }) => {
    const size = opts?.size ?? 10;
    const f = opts?.bold ? bold : font;
    if (y < 60) {
      page = pdf.addPage([612, 792]);
      y = 750;
    }
    page.drawText(text.slice(0, 110), {
      x: 48,
      y,
      size,
      font: f,
      color: rgb(0.1, 0.1, 0.12),
    });
    y -= size + 6;
  };

  draw('Alphaclone Systems — Contract Signature Audit Trail', { size: 14, bold: true });
  draw(`Contract: ${input.title}`);
  draw(`Contract ID: ${input.contractId}`);
  draw(`Status: ${input.status}`);
  draw(`Content SHA-256: ${input.contentHash}`);
  draw(`Generated at: ${new Date().toISOString()}`);
  y -= 8;
  draw('Events', { size: 12, bold: true });

  for (const event of events || []) {
    draw('────────────────────────────────────────');
    draw(`${event.created_at || ''} — ${event.action}`, { bold: true });
    draw(`Signer: ${event.actor_name || 'n/a'} <${event.actor_email || 'n/a'}> (${event.actor_role || 'n/a'})`);
    draw(`IP: ${event.ip_address || 'n/a'}`);
    draw(`UA: ${String(event.user_agent || 'n/a').slice(0, 90)}`);
  }

  draw('────────────────────────────────────────');
  draw(
    'This audit trail records signer identity assertions, IP, user-agent, and content hash for ESIGN/eIDAS evidence.',
    { size: 8 }
  );

  const bytes = await pdf.save();
  const buffer = Buffer.from(bytes);
  const documentHash = createHash('sha256').update(buffer).digest('hex');
  const storagePath = tenantStoragePath(
    input.tenantId,
    'contracts',
    input.contractId,
    `audit-trail-${documentHash.slice(0, 12)}.pdf`
  );

  const { error: uploadError } = await admin.storage
    .from('private')
    .upload(storagePath, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    console.error('[contract-audit-pdf] upload failed:', uploadError.message);
    return null;
  }

  await admin.from('contract_audit_trail').insert({
    contract_id: input.contractId,
    action: 'audit_trail_pdf_generated',
    actor_role: 'system',
    actor_name: 'system',
    details: { storage_path: storagePath, document_hash: documentHash },
  });

  const { data: contract } = await admin
    .from('contracts')
    .select('metadata')
    .eq('id', input.contractId)
    .eq('tenant_id', input.tenantId)
    .maybeSingle();

  const metadata = {
    ...((contract?.metadata as Record<string, unknown>) || {}),
    audit_trail_pdf: storagePath,
    audit_trail_pdf_hash: documentHash,
    audit_trail_pdf_at: new Date().toISOString(),
  };

  await admin
    .from('contracts')
    .update({ metadata })
    .eq('id', input.contractId)
    .eq('tenant_id', input.tenantId);

  return { storagePath, documentHash };
}
