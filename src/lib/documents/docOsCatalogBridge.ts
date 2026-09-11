import type { SupabaseClient } from '@supabase/supabase-js';

export type CatalogDocumentRow = {
  id: string;
  title: string;
  name: string;
  description?: string | null;
  document_type: string;
  status: string;
  owner_user_id?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  storage_path?: string | null;
  expiry_date?: string | null;
  archived_at?: string | null;
  deleted_at?: string | null;
  approval_status?: string | null;
  signature_status?: string | null;
  version?: number | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  doc_os_document_id?: string | null;
  source?: 'catalog' | 'doc_os';
};

type DocOsRow = {
  document_id: string;
  tenant_id: string;
  title: string;
  document_type: string;
  document_number: string;
  status: string;
  version: number;
  owner_user_id?: string | null;
  rendered_pdf_url?: string | null;
  structured_data?: Record<string, unknown> | null;
  expires_at?: string | null;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
};

export function mapDocOsRowToCatalog(row: DocOsRow): CatalogDocumentRow {
  const structured = row.structured_data || {};
  return {
    id: row.document_id,
    title: row.title,
    name: row.title,
    description: typeof structured.summary === 'string' ? structured.summary : null,
    document_type: row.document_type,
    status: row.status,
    owner_user_id: row.owner_user_id ?? null,
    mime_type: row.rendered_pdf_url ? 'application/pdf' : 'application/json',
    size_bytes: null,
    storage_path: row.rendered_pdf_url ?? null,
    expiry_date: row.expires_at ? row.expires_at.slice(0, 10) : null,
    archived_at: row.archived_at ?? null,
    deleted_at: null,
    approval_status:
      typeof structured.approval_status === 'string'
        ? structured.approval_status
        : 'not_requested',
    signature_status:
      row.status === 'signed' || row.status === 'fully_signed'
        ? 'signed'
        : row.status === 'sent'
          ? 'sent'
          : 'not_requested',
    version: row.version,
    metadata: {
      source: 'doc_os',
      document_number: row.document_number,
      structured_data: structured,
      vault: false,
    },
    created_at: row.created_at,
    updated_at: row.updated_at,
    doc_os_document_id: row.document_id,
    source: 'doc_os',
  };
}

/** Include doc_os records not yet linked to the canonical documents table. */
export async function fetchUnlinkedDocOsDocuments(
  admin: SupabaseClient,
  tenantId: string,
  options?: { limit?: number; q?: string; ownerUserId?: string }
): Promise<CatalogDocumentRow[]> {
  const limit = options?.limit ?? 100;

  const { data: linkedRows, error: linkedError } = await admin
    .from('documents')
    .select('doc_os_document_id')
    .eq('tenant_id', tenantId)
    .not('doc_os_document_id', 'is', null);
  if (linkedError) throw linkedError;

  const linkedIds = new Set(
    ((linkedRows || []) as Array<{ doc_os_document_id: string | null }>)
      .map((row) => row.doc_os_document_id)
      .filter(Boolean) as string[]
  );

  let query = admin
    .from('doc_os_documents')
    .select(
      'document_id,tenant_id,title,document_type,document_number,status,version,owner_user_id,rendered_pdf_url,structured_data,expires_at,archived_at,created_at,updated_at'
    )
    .eq('tenant_id', tenantId)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(limit * 2);

  if (options?.ownerUserId) {
    query = query.eq('owner_user_id', options.ownerUserId);
  }
  if (options?.q) {
    const escaped = options.q.replace(/[%_,()]/g, ' ').trim();
    query = query.or(
      `title.ilike.%${escaped}%,document_number.ilike.%${escaped}%,document_type.ilike.%${escaped}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data || []) as DocOsRow[])
    .filter((row) => !linkedIds.has(row.document_id))
    .slice(0, limit)
    .map(mapDocOsRowToCatalog);
}

export function mergeCatalogRows(
  primary: CatalogDocumentRow[],
  bridged: CatalogDocumentRow[]
): CatalogDocumentRow[] {
  const seen = new Set(primary.map((row) => row.doc_os_document_id || row.id));
  const merged = [...primary];
  for (const row of bridged) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return merged.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}
