/**
 * Checksums and immutable version helpers.
 */

import { newId, sha256Hex } from './cryptoUtil';
import type {
  ActorType,
  DocumentActor,
  DocumentEvent,
  DocumentEventAction,
  DocumentStatus,
  DocumentVersion,
} from './types';

export function computeChecksum(payload: unknown): string {
  const canonical = typeof payload === 'string' ? payload : stableStringify(payload);
  return sha256Hex(canonical);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function createVersion(input: {
  document_id: string;
  version_number: number;
  previous_version_id?: string | null;
  structured_content: Record<string, unknown>;
  actor: DocumentActor;
  change_summary?: string;
  change_reason?: string;
  ai_provider?: string;
  ai_model?: string;
  prompt_version?: string;
  rendered_pdf_url?: string;
  mime_type?: string;
  is_signed?: boolean;
}): DocumentVersion {
  const checksum = computeChecksum(input.structured_content);
  return {
    version_id: newId(),
    document_id: input.document_id,
    version_number: input.version_number,
    previous_version_id: input.previous_version_id ?? null,
    structured_content: structuredClone(input.structured_content),
    rendered_pdf_url: input.rendered_pdf_url ?? null,
    editable_source_url: null,
    checksum,
    file_size: null,
    mime_type: input.mime_type || 'application/json',
    change_summary: input.change_summary ?? null,
    change_reason: input.change_reason ?? null,
    created_by_type: input.actor.actor_type as ActorType,
    created_by_id: input.actor.actor_id,
    created_by_name: input.actor.actor_name,
    ai_provider: input.ai_provider ?? null,
    ai_model: input.ai_model ?? null,
    prompt_version: input.prompt_version ?? null,
    created_at: new Date().toISOString(),
    is_signed: Boolean(input.is_signed),
    is_immutable: true,
  };
}

/** Versions are immutable — never overwrite signed records. */
export function assertVersionImmutable(version: DocumentVersion): void {
  if (!version.is_immutable) {
    throw new Error(`Version ${version.version_id} must be immutable`);
  }
}

export function assertCannotOverwriteSigned(version: DocumentVersion): void {
  if (version.is_signed) {
    throw new Error(
      `Signed version ${version.version_id} cannot be overwritten. Create an amendment instead.`
    );
  }
}

export function compareVersions(
  a: DocumentVersion,
  b: DocumentVersion
): {
  left_version: number;
  right_version: number;
  checksum_changed: boolean;
  field_changes: Array<{ path: string; old_value: unknown; new_value: unknown }>;
} {
  const changes: Array<{ path: string; old_value: unknown; new_value: unknown }> = [];
  diffObjects(a.structured_content, b.structured_content, '', changes);
  return {
    left_version: a.version_number,
    right_version: b.version_number,
    checksum_changed: a.checksum !== b.checksum,
    field_changes: changes,
  };
}

function diffObjects(
  left: unknown,
  right: unknown,
  path: string,
  out: Array<{ path: string; old_value: unknown; new_value: unknown }>
): void {
  if (stableStringify(left) === stableStringify(right)) return;
  if (
    left &&
    right &&
    typeof left === 'object' &&
    typeof right === 'object' &&
    !Array.isArray(left) &&
    !Array.isArray(right)
  ) {
    const lk = left as Record<string, unknown>;
    const rk = right as Record<string, unknown>;
    const keys = new Set([...Object.keys(lk), ...Object.keys(rk)]);
    for (const key of keys) {
      diffObjects(lk[key], rk[key], path ? `${path}.${key}` : key, out);
    }
    return;
  }
  out.push({ path: path || '$', old_value: left, new_value: right });
}

export function createEvent(input: {
  document_id: string;
  tenant_id: string;
  actor: DocumentActor;
  action: DocumentEventAction;
  version_id?: string | null;
  previous_status?: DocumentStatus | null;
  new_status?: DocumentStatus | null;
  reason?: string;
  metadata?: Record<string, unknown>;
  provider_reference?: string;
  evidence_url?: string;
  correlation_id?: string;
}): DocumentEvent {
  return {
    event_id: newId(),
    document_id: input.document_id,
    version_id: input.version_id ?? null,
    tenant_id: input.tenant_id,
    actor: input.actor,
    action: input.action,
    previous_status: input.previous_status ?? null,
    new_status: input.new_status ?? null,
    timestamp: new Date().toISOString(),
    reason: input.reason ?? null,
    metadata: input.metadata,
    provider_reference: input.provider_reference ?? null,
    evidence_url: input.evidence_url ?? null,
    correlation_id: input.correlation_id || input.actor.correlation_id || null,
  };
}

export function verifyChecksum(content: unknown, expected: string): boolean {
  return computeChecksum(content) === expected;
}
