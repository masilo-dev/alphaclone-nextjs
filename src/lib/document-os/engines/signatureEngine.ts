/**
 * Electronic signature engine — verified evidence, not typed text in a PDF.
 */

import { newId, sha256Hex } from '../cryptoUtil';
import type { DocumentActor, SignatureRequest } from '../types';

export interface SignatureEnvelope {
  envelope_id: string;
  document_id: string;
  version_id: string;
  document_checksum: string;
  signers: SignatureRequest[];
  status: 'pending' | 'partially_signed' | 'signed' | 'declined' | 'expired';
  created_at: string;
  completed_at?: string;
  expires_at?: string;
  completion_certificate_url?: string;
  signed_pdf_url?: string;
  provider: 'alphaclone_esign';
}

export interface SignatureEvidence {
  envelope_id: string;
  signer_email: string;
  signed_at: string;
  ip_address?: string;
  user_agent?: string;
  document_checksum: string;
  signature_hash: string;
  method: 'drawn' | 'cryptographic' | 'provider';
  /** Typed text alone is never sufficient. */
  typed_text_only: false;
}

export function createSignatureEnvelope(input: {
  document_id: string;
  version_id: string;
  document_checksum: string;
  signers: Array<{ name: string; email: string; role: string; order?: number }>;
  expires_at?: string;
}): SignatureEnvelope {
  return {
    envelope_id: newId(),
    document_id: input.document_id,
    version_id: input.version_id,
    document_checksum: input.document_checksum,
    signers: input.signers.map((s, i) => ({
      signer_name: s.name,
      signer_email: s.email,
      signer_role: s.role,
      signing_order: s.order ?? i + 1,
      status: 'pending',
    })),
    status: 'pending',
    created_at: new Date().toISOString(),
    expires_at: input.expires_at,
    provider: 'alphaclone_esign',
  };
}

/**
 * Record a signature. Rejects typed-text-only "signatures".
 */
export function recordSignature(
  envelope: SignatureEnvelope,
  input: {
    signer_email: string;
    method: 'drawn' | 'cryptographic' | 'provider';
    signature_payload: string;
    ip_address?: string;
    user_agent?: string;
    typed_text_only?: boolean;
  }
): { envelope: SignatureEnvelope; evidence: SignatureEvidence } {
  if (input.typed_text_only || input.method === undefined) {
    throw new Error(
      'Typed text placed inside a PDF is not verified electronic-signature evidence.'
    );
  }
  if (!['drawn', 'cryptographic', 'provider'].includes(input.method)) {
    throw new Error('Unsupported signature method.');
  }
  if (!input.signature_payload || input.signature_payload.length < 16) {
    throw new Error('Signature payload too weak to constitute verified evidence.');
  }

  const signers = envelope.signers.map((s) => {
    if (s.signer_email.toLowerCase() !== input.signer_email.toLowerCase()) return s;
    return {
      ...s,
      status: 'signed' as const,
      signed_at: new Date().toISOString(),
      ip_address: input.ip_address,
      user_agent: input.user_agent,
    };
  });

  const allSigned = signers.every((s) => s.status === 'signed');
  const anySigned = signers.some((s) => s.status === 'signed');
  const status = allSigned ? 'signed' : anySigned ? 'partially_signed' : envelope.status;

  const evidence: SignatureEvidence = {
    envelope_id: envelope.envelope_id,
    signer_email: input.signer_email,
    signed_at: new Date().toISOString(),
    ip_address: input.ip_address,
    user_agent: input.user_agent,
    document_checksum: envelope.document_checksum,
    signature_hash: sha256Hex(input.signature_payload),
    method: input.method,
    typed_text_only: false,
  };

  return {
    envelope: {
      ...envelope,
      signers,
      status,
      completed_at: allSigned ? new Date().toISOString() : envelope.completed_at,
    },
    evidence,
  };
}

export function getSignatureStatus(envelope: SignatureEnvelope) {
  return {
    envelope_id: envelope.envelope_id,
    status: envelope.status,
    signers: envelope.signers.map((s) => ({
      name: s.signer_name,
      email: s.signer_email,
      role: s.signer_role,
      order: s.signing_order,
      status: s.status,
      signed_at: s.signed_at,
    })),
    document_checksum: envelope.document_checksum,
    completed_at: envelope.completed_at,
  };
}

export function requireOwnerApprovalForSensitiveAction(
  action:
    | 'send_contract'
    | 'send_invoice'
    | 'accept_terms'
    | 'sign'
    | 'change_payment_details'
    | 'issue_refund'
    | 'void_financial'
    | 'delete_archive',
  actor: DocumentActor,
  ownerApproved: boolean
): void {
  const sensitive = new Set([
    'send_contract',
    'send_invoice',
    'accept_terms',
    'sign',
    'change_payment_details',
    'issue_refund',
    'void_financial',
    'delete_archive',
  ]);
  if (!sensitive.has(action)) return;
  const isHumanOwner = actor.actor_type === 'user' || actor.actor_type === 'employee';
  if (!isHumanOwner && !ownerApproved) {
    throw new Error(
      `Action "${action}" requires in-chat owner approval before an AI agent may proceed.`
    );
  }
}
