/**
 * Alphaclone Document Operating System — core types.
 * Tenant-aware professional document identity, lifecycle, and records.
 */

export const DOCUMENT_TYPES = [
  'contract',
  'msa',
  'sla',
  'sow',
  'proposal',
  'quote',
  'estimate',
  'invoice',
  'receipt',
  'credit_note',
  'payment_reminder',
  'purchase_order',
  'delivery_note',
  'business_letter',
  'offer_letter',
  'employment_agreement',
  'nda',
  'client_onboarding',
  'project_report',
  'financial_report',
  'audit_report',
  'certificate',
  'meeting_summary',
  'campaign_report',
  'custom_template',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Normalized document lifecycle statuses (not payment status). */
export const DOCUMENT_STATUSES = [
  'draft',
  'under_review',
  'changes_requested',
  'revised',
  'awaiting_approval',
  'approved',
  'sent',
  'delivered',
  'viewed',
  'accepted',
  'declined',
  'awaiting_signature',
  'partially_signed',
  'signed',
  'active',
  'completed',
  'terminated',
  'expired',
  'superseded',
  'void',
  'archived',
  'converted_to_contract',
  'converted_to_invoice',
  'converted_to_project',
  'internal_review',
  'partially_paid',
  'paid',
  'overdue',
  'receipted',
  'partially_refunded',
  'refunded',
  'restored',
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/** Invoice payment statuses — kept separate from document lifecycle. */
export const INVOICE_PAYMENT_STATUSES = [
  'draft',
  'sent',
  'viewed',
  'partially_paid',
  'paid',
  'overdue',
  'void',
  'refunded',
] as const;

export type InvoicePaymentStatus = (typeof INVOICE_PAYMENT_STATUSES)[number];

export const ACTOR_TYPES = [
  'user',
  'client',
  'employee',
  'chatgpt',
  'claude',
  'gemini',
  'deepseek',
  'bonnie',
  'cursor',
  'workflow',
  'integration',
  'system',
  'api_client',
] as const;

export type ActorType = (typeof ACTOR_TYPES)[number];

export interface DocumentActor {
  actor_type: ActorType;
  actor_id: string;
  actor_name: string;
  authenticated_session_id?: string;
  oauth_client_id?: string;
  ip_address?: string;
  user_agent?: string;
  correlation_id?: string;
  timestamp?: string;
}

export const DOCUMENT_EVENTS = [
  'document_created',
  'content_generated',
  'version_created',
  'metadata_updated',
  'validation_started',
  'validation_failed',
  'validation_passed',
  'submitted_for_review',
  'review_requested',
  'review_started',
  'changes_requested',
  'approved',
  'rejected',
  'sent',
  'delivered',
  'delivery_failed',
  'viewed',
  'downloaded',
  'accepted',
  'declined',
  'signature_requested',
  'partially_signed',
  'signed',
  'signature_expired',
  'payment_requested',
  'partially_paid',
  'paid',
  'refunded',
  'voided',
  'amended',
  'superseded',
  'archived',
  'restored',
  'deleted_under_policy',
  'export_created',
  'legal_hold_placed',
  'legal_hold_released',
] as const;

export type DocumentEventAction = (typeof DOCUMENT_EVENTS)[number];

export type LogoPlacement = 'left' | 'center' | 'right';
export type PageSize = 'A4' | 'Letter';

export interface AuthorizedSignatory {
  id: string;
  name: string;
  title: string;
  email: string;
  signature_image_url?: string;
  is_default?: boolean;
}

export interface BankDetails {
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  routing_number?: string;
  iban?: string;
  swift_bic?: string;
  branch?: string;
}

export interface DocumentBrandProfile {
  tenant_id: string;
  legal_business_name: string;
  trading_name?: string;
  registration_number?: string;
  tax_vat_number?: string;
  physical_address?: string;
  postal_address?: string;
  business_email?: string;
  telephone?: string;
  website?: string;
  default_currency: string;
  country?: string;
  jurisdiction?: string;
  primary_logo_url?: string;
  secondary_logo_url?: string;
  monochrome_logo_url?: string;
  favicon_url?: string;
  primary_colour: string;
  secondary_colour: string;
  accent_colour: string;
  heading_font: string;
  body_font: string;
  logo_placement: LogoPlacement;
  authorized_signatories: AuthorizedSignatory[];
  bank_details?: BankDetails;
  payment_instructions?: string;
  legal_footer?: string;
  social_links?: Record<string, string>;
  page_size: PageSize;
}

export interface DocumentRecord {
  document_id: string;
  tenant_id: string;
  client_id?: string | null;
  company_id?: string | null;
  project_id?: string | null;
  workflow_id?: string | null;
  parent_document_id?: string | null;
  source_document_id?: string | null;
  document_type: DocumentType;
  document_number: string;
  title: string;
  current_version_id?: string | null;
  version: number;
  status: DocumentStatus;
  currency: string;
  source_template_id?: string | null;
  structured_data: Record<string, unknown>;
  rendered_pdf_url?: string | null;
  editable_source?: Record<string, unknown> | null;
  owner_user_id?: string | null;
  department?: string | null;
  classification?: string | null;
  retention_policy_id?: string | null;
  created_by?: string | null;
  approved_by?: string | null;
  sent_to?: string[] | null;
  created_at: string;
  updated_at: string;
  sent_at?: string | null;
  viewed_at?: string | null;
  signed_at?: string | null;
  expires_at?: string | null;
  archived_at?: string | null;
  checksum?: string | null;
  legal_hold?: boolean;
}

export interface DocumentVersion {
  version_id: string;
  document_id: string;
  version_number: number;
  previous_version_id?: string | null;
  structured_content: Record<string, unknown>;
  rendered_pdf_url?: string | null;
  editable_source_url?: string | null;
  checksum: string;
  file_size?: number | null;
  mime_type: string;
  change_summary?: string | null;
  change_reason?: string | null;
  created_by_type: ActorType;
  created_by_id: string;
  created_by_name: string;
  ai_provider?: string | null;
  ai_model?: string | null;
  prompt_version?: string | null;
  created_at: string;
  is_signed: boolean;
  is_immutable: boolean;
}

export interface DocumentEvent {
  event_id: string;
  document_id: string;
  version_id?: string | null;
  tenant_id: string;
  actor: DocumentActor;
  action: DocumentEventAction;
  previous_status?: DocumentStatus | null;
  new_status?: DocumentStatus | null;
  timestamp: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  provider_reference?: string | null;
  evidence_url?: string | null;
  correlation_id?: string | null;
}

export interface ValidationIssue {
  code: string;
  message: string;
  field?: string;
  severity: 'blocking' | 'warning';
  recommended_fix?: string;
}

export interface DocumentValidationResult {
  valid: boolean;
  blocking_issues: ValidationIssue[];
  warnings: ValidationIssue[];
  layout_issues: ValidationIssue[];
  financial_issues: ValidationIssue[];
  legal_consistency_issues: ValidationIssue[];
  brand_issues: ValidationIssue[];
  recommended_fixes: string[];
}

export interface ContractClause {
  clause_id: string;
  clause_key: string;
  title: string;
  body: string;
  version: string;
  order: number;
  required?: boolean;
}

export const CONTRACT_CLAUSE_KEYS = [
  'parties',
  'scope',
  'deliverables',
  'revisions',
  'fees',
  'deposits',
  'milestones',
  'timeline',
  'payment_terms',
  'intellectual_property',
  'confidentiality',
  'warranties',
  'liability',
  'termination',
  'dispute_resolution',
  'governing_law',
  'notices',
  'signatures',
  'schedules',
  'indemnification',
] as const;

export type ContractClauseKey = (typeof CONTRACT_CLAUSE_KEYS)[number];

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  discount?: number;
  amount: number;
  tax_rate?: number;
}

export interface InvoiceStructuredData {
  supplier: Partial<DocumentBrandProfile>;
  client: {
    legal_name: string;
    email?: string;
    address?: string;
    tax_id?: string;
  };
  invoice_number: string;
  issue_date: string;
  due_date: string;
  currency: string;
  line_items: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  payment_terms?: string;
  payment_method?: string;
  payment_link?: string;
  bank_details?: BankDetails;
  notes?: string;
  related_contract_id?: string;
  related_quote_id?: string;
  payment_transactions?: PaymentTransaction[];
  payment_status: InvoicePaymentStatus;
}

export interface PaymentTransaction {
  transaction_id: string;
  amount: number;
  currency: string;
  paid_at: string;
  method: string;
  provider?: string;
  reference: string;
  payer_name?: string;
  evidence_url?: string;
  verified: boolean;
}

export interface SignatureRequest {
  signer_name: string;
  signer_email: string;
  signer_role: string;
  signing_order: number;
  status: 'pending' | 'signed' | 'declined' | 'expired';
  signed_at?: string;
  decline_reason?: string;
  ip_address?: string;
  user_agent?: string;
  signature_certificate_url?: string;
}

export interface ApprovalDecision {
  approval_id: string;
  document_id: string;
  version_id: string;
  approver: DocumentActor;
  decision: 'approved' | 'rejected' | 'changes_requested';
  comments?: string;
  decided_at: string;
  evidence?: string;
  expiration?: string;
}

export type WriteToolMeta = {
  idempotency_key?: string;
  expected_current_version?: number;
  reason?: string;
  correlation_id?: string;
};
