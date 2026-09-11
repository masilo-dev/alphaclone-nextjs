/**
 * In-memory Document OS store + service.
 * Used for unit/integration tests and as the domain layer for MCP/API adapters.
 */

import { newId } from '../../lib/document-os/cryptoUtil';
import type {
  DocumentActor,
  DocumentEvent,
  DocumentRecord,
  DocumentStatus,
  DocumentType,
  DocumentValidationResult,
  DocumentVersion,
  WriteToolMeta,
  DocumentBrandProfile,
} from '../../lib/document-os/types';
import { resolveActorFromSession, type AuthenticatedSession } from '../../lib/document-os/actors';
import { compareVersions, computeChecksum, createEvent, createVersion } from '../../lib/document-os/checksum';
import {
  assertInvoicePaymentRules,
  assertNotDirectSign,
  assertTransition,
  isEditableStatus,
  requiresAmendment,
} from '../../lib/document-os/lifecycle';
import { assertCanSendOrSign, validateDocument, type ValidateDocumentInput } from '../../lib/document-os/validation';
import { renderCorporateDocumentHtml, type CorporateRenderInput } from '../../lib/document-os/corporateRenderer';

export interface DocumentOsStore {
  documents: Map<string, DocumentRecord>;
  versions: Map<string, DocumentVersion[]>;
  events: DocumentEvent[];
  idempotency: Map<string, string>;
}

export function createDocumentOsStore(): DocumentOsStore {
  return {
    documents: new Map(),
    versions: new Map(),
    events: [],
    idempotency: new Map(),
  };
}

function appendEvent(store: DocumentOsStore, event: DocumentEvent): DocumentEvent {
  store.events.push(event);
  return event;
}

function nextDocumentNumber(type: DocumentType, store: DocumentOsStore): string {
  const prefix =
    {
      invoice: 'INV',
      quote: 'QTE',
      estimate: 'EST',
      contract: 'CTR',
      receipt: 'RCT',
      proposal: 'PRP',
      nda: 'NDA',
      credit_note: 'CN',
    }[type as string] || 'DOC';
  const count = [...store.documents.values()].filter((d) => d.document_type === type).length + 1;
  return `${prefix}-${String(count).padStart(5, '0')}`;
}

export class DocumentOsService {
  constructor(
    private store: DocumentOsStore,
    private brand: DocumentBrandProfile
  ) {}

  private actor(session: AuthenticatedSession): DocumentActor {
    return resolveActorFromSession(session);
  }

  private checkIdempotency(meta?: WriteToolMeta): string | null {
    if (!meta?.idempotency_key) return null;
    return this.store.idempotency.get(meta.idempotency_key) || null;
  }

  private saveIdempotency(meta: WriteToolMeta | undefined, documentId: string): void {
    if (meta?.idempotency_key) this.store.idempotency.set(meta.idempotency_key, documentId);
  }

  createDocument(input: {
    session: AuthenticatedSession;
    document_type: DocumentType;
    title: string;
    structured_data: Record<string, unknown>;
    client_id?: string;
    company_id?: string;
    project_id?: string;
    source_template_id?: string;
    parent_document_id?: string;
    source_document_id?: string;
    currency?: string;
    meta?: WriteToolMeta;
  }): DocumentRecord {
    const existing = this.checkIdempotency(input.meta);
    if (existing) return this.store.documents.get(existing)!;

    if (input.structured_data.html || input.structured_data.sql) {
      throw new Error('AI must provide structured document data only — raw HTML/SQL is forbidden.');
    }

    const actor = this.actor(input.session);
    const document_id = newId();
    const now = new Date().toISOString();
    const version = createVersion({
      document_id,
      version_number: 1,
      structured_content: input.structured_data,
      actor,
      change_summary: 'Initial version',
      change_reason: input.meta?.reason,
    });

    const record: DocumentRecord = {
      document_id,
      tenant_id: this.brand.tenant_id,
      client_id: input.client_id ?? null,
      company_id: input.company_id ?? null,
      project_id: input.project_id ?? null,
      parent_document_id: input.parent_document_id ?? null,
      source_document_id: input.source_document_id ?? null,
      document_type: input.document_type,
      document_number: nextDocumentNumber(input.document_type, this.store),
      title: input.title,
      current_version_id: version.version_id,
      version: 1,
      status: 'draft',
      currency: input.currency || this.brand.default_currency,
      source_template_id: input.source_template_id ?? null,
      structured_data: input.structured_data,
      created_by: actor.actor_id,
      owner_user_id: actor.actor_id,
      created_at: now,
      updated_at: now,
      checksum: version.checksum,
    };

    this.store.documents.set(document_id, record);
    this.store.versions.set(document_id, [version]);
    appendEvent(
      this.store,
      createEvent({
        document_id,
        tenant_id: this.brand.tenant_id,
        actor,
        action: 'document_created',
        version_id: version.version_id,
        new_status: 'draft',
        correlation_id: input.meta?.correlation_id,
      })
    );
    appendEvent(
      this.store,
      createEvent({
        document_id,
        tenant_id: this.brand.tenant_id,
        actor,
        action: 'version_created',
        version_id: version.version_id,
        new_status: 'draft',
      })
    );
    this.saveIdempotency(input.meta, document_id);
    return record;
  }

  updateDocument(input: {
    session: AuthenticatedSession;
    document_id: string;
    structured_data: Record<string, unknown>;
    title?: string;
    change_summary?: string;
    meta?: WriteToolMeta;
  }): DocumentRecord {
    const doc = this.requireDoc(input.document_id);
    if (input.meta?.expected_current_version != null && input.meta.expected_current_version !== doc.version) {
      throw new Error(
        `Optimistic concurrency conflict: expected version ${input.meta.expected_current_version}, current is ${doc.version}`
      );
    }
    if (requiresAmendment(doc.status) && doc.document_type !== 'invoice') {
      throw new Error(
        `Document status ${doc.status} cannot be edited in place. Use amend_document to create a new version requiring acceptance.`
      );
    }
    const invoicePaymentUpdate =
      doc.document_type === 'invoice' &&
      ['sent', 'viewed', 'partially_paid', 'overdue', 'approved'].includes(doc.status);
    if (!isEditableStatus(doc.status) && doc.status !== 'approved' && !invoicePaymentUpdate) {
      throw new Error(`Document in status ${doc.status} is not editable.`);
    }

    const actor = this.actor(input.session);
    const versions = this.store.versions.get(doc.document_id)!;
    const previous = versions[versions.length - 1];
    const nextNum = doc.version + 1;
    const version = createVersion({
      document_id: doc.document_id,
      version_number: nextNum,
      previous_version_id: previous.version_id,
      structured_content: input.structured_data,
      actor,
      change_summary: input.change_summary || 'Content update',
      change_reason: input.meta?.reason,
    });
    versions.push(version);

    const updated: DocumentRecord = {
      ...doc,
      title: input.title || doc.title,
      structured_data: input.structured_data,
      version: nextNum,
      current_version_id: version.version_id,
      checksum: version.checksum,
      updated_at: new Date().toISOString(),
      status: doc.status === 'changes_requested' ? 'revised' : doc.status,
    };
    this.store.documents.set(doc.document_id, updated);
    appendEvent(
      this.store,
      createEvent({
        document_id: doc.document_id,
        tenant_id: doc.tenant_id,
        actor,
        action: 'version_created',
        version_id: version.version_id,
        previous_status: doc.status,
        new_status: updated.status,
        reason: input.meta?.reason,
        correlation_id: input.meta?.correlation_id,
      })
    );
    return updated;
  }

  amendDocument(input: {
    session: AuthenticatedSession;
    document_id: string;
    structured_data: Record<string, unknown>;
    change_summary: string;
    meta?: WriteToolMeta;
  }): DocumentRecord {
    const doc = this.requireDoc(input.document_id);
    const actor = this.actor(input.session);
    const versions = this.store.versions.get(doc.document_id)!;
    const previous = versions[versions.length - 1];
    assertCannotOverwriteIfSigned(previous);

    const version = createVersion({
      document_id: doc.document_id,
      version_number: doc.version + 1,
      previous_version_id: previous.version_id,
      structured_content: {
        ...input.structured_data,
        amends_document_id: doc.document_id,
        amends_version_id: previous.version_id,
      },
      actor,
      change_summary: input.change_summary,
      change_reason: input.meta?.reason || 'amendment',
    });
    versions.push(version);

    const updated: DocumentRecord = {
      ...doc,
      structured_data: version.structured_content,
      version: version.version_number,
      current_version_id: version.version_id,
      checksum: version.checksum,
      status: 'draft',
      updated_at: new Date().toISOString(),
    };
    this.store.documents.set(doc.document_id, updated);
    appendEvent(
      this.store,
      createEvent({
        document_id: doc.document_id,
        tenant_id: doc.tenant_id,
        actor,
        action: 'amended',
        version_id: version.version_id,
        previous_status: doc.status,
        new_status: 'draft',
        reason: input.change_summary,
      })
    );
    return updated;
  }

  validate(
    document_id: string,
    extra?: Partial<ValidateDocumentInput>
  ): DocumentValidationResult {
    const doc = this.requireDoc(document_id);
    const clauses = (doc.structured_data.clauses || extra?.clauses) as ValidateDocumentInput['clauses'];
    return validateDocument({
      documentType: doc.document_type,
      brand: this.brand,
      structuredData: { ...doc.structured_data, status: doc.status },
      clauses,
      invoice: extra?.invoice,
      layout: extra?.layout,
      logo: extra?.logo,
      permissions: extra?.permissions,
      contractMilestones: extra?.contractMilestones,
      invoiceMilestones: extra?.invoiceMilestones,
      renderedText: extra?.renderedText,
    });
  }

  preview(document_id: string, renderInput: Omit<CorporateRenderInput, 'brand' | 'documentType' | 'documentNumber' | 'version' | 'status' | 'title'> & Partial<CorporateRenderInput>): string {
    const doc = this.requireDoc(document_id);
    return renderCorporateDocumentHtml({
      documentType: doc.document_type,
      brand: this.brand,
      title: renderInput.title || doc.title,
      documentNumber: doc.document_number,
      version: doc.version,
      status: doc.status,
      clientName: renderInput.clientName,
      clientEmail: renderInput.clientEmail,
      clientAddress: renderInput.clientAddress,
      issueDate: renderInput.issueDate,
      dueDate: renderInput.dueDate,
      expiresAt: renderInput.expiresAt,
      currency: doc.currency,
      confidentialityLabel: renderInput.confidentialityLabel || 'Confidential',
      referenceNumber: renderInput.referenceNumber,
      clauses: renderInput.clauses,
      sections: renderInput.sections,
      invoice: renderInput.invoice,
      notes: renderInput.notes,
      approvalHistory: renderInput.approvalHistory,
      signatureBlocks: renderInput.signatureBlocks,
      showSignatures:
        renderInput.showSignatures ??
        (doc.status === 'signed' || doc.status === 'partially_signed'),
      qrCodeDataUrl: renderInput.qrCodeDataUrl,
      metadata: {
        documentId: doc.document_id,
        author: this.brand.legal_business_name,
        subject: doc.title,
        ...renderInput.metadata,
      },
    });
  }

  transition(input: {
    session: AuthenticatedSession;
    document_id: string;
    to: DocumentStatus;
    action: DocumentEvent['action'];
    reason?: string;
    sent_to?: string[];
    requireValidation?: boolean;
    validationExtra?: Partial<ValidateDocumentInput>;
    meta?: WriteToolMeta;
  }): DocumentRecord {
    const doc = this.requireDoc(input.document_id);
    assertTransition(doc.document_type, doc.status, input.to);
    assertNotDirectSign(doc.status, input.to);
    if (doc.document_type === 'invoice') assertInvoicePaymentRules(doc.status, input.to);

    if (input.requireValidation || ['sent', 'awaiting_signature', 'signed', 'approved'].includes(input.to)) {
      const result = this.validate(doc.document_id, input.validationExtra);
      appendEvent(
        this.store,
        createEvent({
          document_id: doc.document_id,
          tenant_id: doc.tenant_id,
          actor: this.actor(input.session),
          action: result.valid ? 'validation_passed' : 'validation_failed',
          previous_status: doc.status,
          metadata: result as unknown as Record<string, unknown>,
        })
      );
      if (['sent', 'awaiting_signature', 'signed', 'approved'].includes(input.to)) {
        assertCanSendOrSign(
          result,
          input.to === 'approved' ? 'approve' : input.to === 'signed' ? 'sign' : 'send'
        );
      }
    }

    const actor = this.actor(input.session);
    const updated: DocumentRecord = {
      ...doc,
      status: input.to,
      updated_at: new Date().toISOString(),
      sent_to: input.sent_to || doc.sent_to,
      sent_at: input.to === 'sent' ? new Date().toISOString() : doc.sent_at,
      viewed_at: input.to === 'viewed' ? new Date().toISOString() : doc.viewed_at,
      signed_at: input.to === 'signed' ? new Date().toISOString() : doc.signed_at,
      approved_by: input.to === 'approved' ? actor.actor_id : doc.approved_by,
      archived_at: input.to === 'archived' ? new Date().toISOString() : doc.archived_at,
    };

    if (input.to === 'signed') {
      const versions = this.store.versions.get(doc.document_id)!;
      const current = versions[versions.length - 1];
      current.is_signed = true;
    }

    this.store.documents.set(doc.document_id, updated);
    appendEvent(
      this.store,
      createEvent({
        document_id: doc.document_id,
        tenant_id: doc.tenant_id,
        actor,
        action: input.action,
        version_id: doc.current_version_id,
        previous_status: doc.status,
        new_status: input.to,
        reason: input.reason || input.meta?.reason,
        correlation_id: input.meta?.correlation_id,
      })
    );
    return updated;
  }

  getDocument(document_id: string): DocumentRecord {
    return this.requireDoc(document_id);
  }

  listVersions(document_id: string): DocumentVersion[] {
    this.requireDoc(document_id);
    return [...(this.store.versions.get(document_id) || [])];
  }

  compareDocumentVersions(document_id: string, left: number, right: number) {
    const versions = this.listVersions(document_id);
    const a = versions.find((v) => v.version_number === left);
    const b = versions.find((v) => v.version_number === right);
    if (!a || !b) throw new Error('Version not found');
    return compareVersions(a, b);
  }

  getTimeline(document_id: string): DocumentEvent[] {
    this.requireDoc(document_id);
    return this.store.events
      .filter((e) => e.document_id === document_id)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  search(query: string): DocumentRecord[] {
    const q = query.toLowerCase();
    return [...this.store.documents.values()].filter((d) => {
      if (d.tenant_id !== this.brand.tenant_id) return false;
      return (
        d.title.toLowerCase().includes(q) ||
        d.document_number.toLowerCase().includes(q) ||
        d.document_type.includes(q) ||
        d.status.includes(q) ||
        JSON.stringify(d.structured_data).toLowerCase().includes(q)
      );
    });
  }

  private requireDoc(id: string): DocumentRecord {
    const doc = this.store.documents.get(id);
    if (!doc) throw new Error(`Document not found: ${id}`);
    if (doc.tenant_id !== this.brand.tenant_id) throw new Error('Tenant isolation violation');
    return doc;
  }
}

function assertCannotOverwriteIfSigned(version: DocumentVersion): void {
  if (version.is_signed) {
    // Amendment creates a new version — previous remains immutable.
    return;
  }
  void computeChecksum(version.structured_content);
}
