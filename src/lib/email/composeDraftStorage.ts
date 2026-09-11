import type { DeliveryEmailProvider } from '@/lib/email/emailProviderOptions';

export type StoredComposeDraft = {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  deliveryProvider: DeliveryEmailProvider;
  updatedAt: string;
};

function storageKey(tenantId: string, userId: string) {
  return `alphaclone:email-draft:${tenantId}:${userId}`;
}

export function loadLocalComposeDraft(
  tenantId: string,
  userId: string
): StoredComposeDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(tenantId, userId));
    if (!raw) return null;
    return JSON.parse(raw) as StoredComposeDraft;
  } catch {
    return null;
  }
}

export function saveLocalComposeDraft(
  tenantId: string,
  userId: string,
  draft: Omit<StoredComposeDraft, 'updatedAt'>
) {
  if (typeof window === 'undefined') return;
  const payload: StoredComposeDraft = { ...draft, updatedAt: new Date().toISOString() };
  window.localStorage.setItem(storageKey(tenantId, userId), JSON.stringify(payload));
}

export function clearLocalComposeDraft(tenantId: string, userId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKey(tenantId, userId));
}
