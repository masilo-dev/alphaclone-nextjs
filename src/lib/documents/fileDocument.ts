import type { SupabaseClient } from '@supabase/supabase-js';

export type DocumentEntityLink = {
  entityType: string;
  entityId: string;
  relationshipType: string;
  isPrimary?: boolean;
};

export type CatalogDocumentInput = {
  tenantId: string;
  userId: string;
  title: string;
  documentType: string;
  status?: string;
  storagePath?: string | null;
  storageBucket?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  content?: string | null;
  metadata?: Record<string, unknown>;
  vault?: boolean;
  sourceFileId?: string | null;
  links?: DocumentEntityLink[];
  autoIndex?: boolean;
  existingDocumentId?: string | null;
};

const DEFAULT_INTELLIGENCE_JOBS = ['classify', 'extract', 'summarize'] as const;

export async function findDocumentIdForEntity(
  admin: SupabaseClient,
  tenantId: string,
  entityType: string,
  entityId: string
): Promise<string | null> {
  const { data } = await admin
    .from('document_relationships')
    .select('document_id')
    .eq('tenant_id', tenantId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.document_id ? String(data.document_id) : null;
}

export async function queueDocumentIntelligence(
  admin: SupabaseClient,
  tenantId: string,
  documentId: string,
  userId: string,
  jobs: readonly string[] = DEFAULT_INTELLIGENCE_JOBS
): Promise<void> {
  const rows = jobs.map((jobType) => ({
    tenant_id: tenantId,
    document_id: documentId,
    job_type: jobType,
    status: 'queued',
    input: { requested_by: userId, source: 'auto_index' },
  }));

  const { error } = await admin.from('document_intelligence_jobs').insert(rows);
  if (error) {
    console.error('[fileDocument] intelligence queue failed', error.message);
    return;
  }

  await admin
    .from('documents')
    .update({
      intelligence_status: 'queued',
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', documentId);
}

async function insertDocumentLinks(
  admin: SupabaseClient,
  tenantId: string,
  documentId: string,
  userId: string,
  links: DocumentEntityLink[] | undefined
): Promise<void> {
  if (!links?.length) return;
  const payload = links.map((link) => ({
    tenant_id: tenantId,
    document_id: documentId,
    entity_type: link.entityType,
    entity_id: link.entityId,
    relationship_type: link.relationshipType,
    is_primary: link.isPrimary ?? false,
    created_by: userId,
  }));
  const { error } = await admin.from('document_relationships').insert(payload);
  if (error) console.error('[fileDocument] relationship insert failed', error.message);
}

async function registerVaultFileUpload(
  admin: SupabaseClient,
  input: CatalogDocumentInput,
  documentId: string
): Promise<string | null> {
  if (!input.storagePath) return null;

  const bucket = input.storageBucket || 'uploads';
  const tags = ['vault', 'indexed', input.documentType];
  if (bucket !== 'uploads') tags.push(`bucket:${bucket}`);

  const { data, error } = await admin
    .from('file_uploads')
    .insert({
      user_id: input.userId,
      tenant_id: input.tenantId,
      filename: input.storagePath,
      original_filename: input.title,
      file_type: input.mimeType || 'application/octet-stream',
      file_size: input.sizeBytes || 0,
      storage_path: input.storagePath,
      scan_status: 'clean',
      entity_type: input.links?.[0]?.entityType || input.documentType,
      entity_id: input.links?.[0]?.entityId || null,
      tags,
      category: input.documentType,
      document_id: documentId,
      ai_summary: `Auto-filed ${input.documentType}`,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[fileDocument] vault file_uploads insert failed', error.message);
    return null;
  }
  return data?.id ? String(data.id) : null;
}

export async function upsertCatalogDocument(
  admin: SupabaseClient,
  input: CatalogDocumentInput
): Promise<{ documentId: string; fileUploadId: string | null }> {
  const metadata = {
    ...(input.metadata || {}),
    source: input.metadata?.source || 'catalog_upsert',
    vault: input.vault !== false,
    storage_bucket: input.storageBucket || null,
  };

  const payload = {
    tenant_id: input.tenantId,
    title: input.title,
    name: input.title,
    document_type: input.documentType,
    status: input.status || 'active',
    content: input.content ?? null,
    mime_type: input.mimeType || null,
    size_bytes: input.sizeBytes || null,
    storage_path: input.storagePath || null,
    owner_user_id: input.userId,
    uploaded_by: input.userId,
    source_file_id: input.sourceFileId || null,
    metadata,
    updated_at: new Date().toISOString(),
  };

  let documentId = input.existingDocumentId || null;

  if (!documentId && input.links?.length) {
    documentId = await findDocumentIdForEntity(
      admin,
      input.tenantId,
      input.links[0].entityType,
      input.links[0].entityId
    );
  }

  if (documentId) {
    const { error } = await admin
      .from('documents')
      .update(payload)
      .eq('tenant_id', input.tenantId)
      .eq('id', documentId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await admin.from('documents').insert(payload).select('id').single();
    if (error) throw new Error(error.message);
    documentId = String(data.id);
    await insertDocumentLinks(admin, input.tenantId, documentId, input.userId, input.links);
  }

  await admin.from('document_activity').insert({
    tenant_id: input.tenantId,
    document_id: documentId,
    actor_user_id: input.userId,
    action: input.storagePath ? 'document_file_attached' : 'document_cataloged',
    new_values: {
      document_type: input.documentType,
      storage_path: input.storagePath || null,
      vault: input.vault !== false,
    },
  });

  let fileUploadId: string | null = null;
  if (input.vault !== false && input.storagePath) {
    fileUploadId = await registerVaultFileUpload(admin, input, documentId);
    if (fileUploadId) {
      await admin
        .from('documents')
        .update({ source_file_id: fileUploadId, updated_at: new Date().toISOString() })
        .eq('tenant_id', input.tenantId)
        .eq('id', documentId);
    }
  }

  if (input.autoIndex !== false) {
    await queueDocumentIntelligence(admin, input.tenantId, documentId, input.userId);
  }

  return { documentId, fileUploadId };
}

export async function fileInvoiceDocument(
  admin: SupabaseClient,
  params: {
    tenantId: string;
    userId: string;
    invoice: {
      id: string;
      invoice_number?: string | null;
      status?: string | null;
      total?: number | null;
      client_id?: string | null;
      project_id?: string | null;
      contract_id?: string | null;
    };
    storagePath?: string | null;
    storageBucket?: string | null;
    sizeBytes?: number | null;
  }
): Promise<{ documentId: string }> {
  const title = `Invoice ${params.invoice.invoice_number || params.invoice.id}`;
  const links: DocumentEntityLink[] = [
    {
      entityType: 'invoice',
      entityId: params.invoice.id,
      relationshipType: 'belongs_to',
      isPrimary: true,
    },
  ];
  if (params.invoice.client_id) {
    links.push({
      entityType: 'customer',
      entityId: params.invoice.client_id,
      relationshipType: 'billing_document',
    });
  }
  if (params.invoice.project_id) {
    links.push({
      entityType: 'project',
      entityId: params.invoice.project_id,
      relationshipType: 'project_file',
    });
  }
  if (params.invoice.contract_id) {
    links.push({
      entityType: 'contract',
      entityId: params.invoice.contract_id,
      relationshipType: 'billing_document',
    });
  }

  const existingDocumentId = await findDocumentIdForEntity(
    admin,
    params.tenantId,
    'invoice',
    params.invoice.id
  );

  const result = await upsertCatalogDocument(admin, {
    tenantId: params.tenantId,
    userId: params.userId,
    title,
    documentType: 'invoice',
    status: params.invoice.status === 'sent' ? 'active' : 'draft',
    storagePath: params.storagePath || null,
    storageBucket: params.storageBucket || 'invoice-documents',
    mimeType: 'application/pdf',
    sizeBytes: params.sizeBytes || null,
    metadata: {
      invoice_id: params.invoice.id,
      invoice_number: params.invoice.invoice_number,
      total: params.invoice.total,
      contract_id: params.invoice.contract_id || null,
      source: 'invoice_auto_save',
    },
    vault: true,
    links,
    existingDocumentId,
  });

  return { documentId: result.documentId };
}

export async function fileContractPdfDocument(
  admin: SupabaseClient,
  params: {
    tenantId: string;
    userId: string;
    contract: {
      id: string;
      title?: string | null;
      client_id?: string | null;
      project_id?: string | null;
      document_id?: string | null;
      status?: string | null;
    };
    storagePath: string;
    storageBucket?: string;
    sizeBytes?: number | null;
  }
): Promise<{ documentId: string }> {
  const links: DocumentEntityLink[] = [
    {
      entityType: 'contract',
      entityId: params.contract.id,
      relationshipType: 'belongs_to',
      isPrimary: true,
    },
  ];
  if (params.contract.client_id) {
    links.push({
      entityType: 'customer',
      entityId: params.contract.client_id,
      relationshipType: 'signed_agreement',
    });
  }
  if (params.contract.project_id) {
    links.push({
      entityType: 'project',
      entityId: params.contract.project_id,
      relationshipType: 'project_file',
    });
  }

  const result = await upsertCatalogDocument(admin, {
    tenantId: params.tenantId,
    userId: params.userId,
    title: `${params.contract.title || 'Contract'}.pdf`,
    documentType: 'contract',
    status: params.contract.status === 'fully_signed' ? 'active' : 'draft',
    storagePath: params.storagePath,
    storageBucket: params.storageBucket || 'contracts',
    mimeType: 'application/pdf',
    sizeBytes: params.sizeBytes || null,
    metadata: {
      contract_id: params.contract.id,
      source: 'contract_pdf',
    },
    vault: true,
    links,
    existingDocumentId: params.contract.document_id || null,
  });

  return { documentId: result.documentId };
}
