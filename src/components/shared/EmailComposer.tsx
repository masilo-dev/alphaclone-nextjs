'use client';

/**
 * Canonical email composer for the entire platform.
 * Wraps ComposeEmailModal with the shared props contract from Issue 7.
 */
export { default } from '@/components/dashboard/business/ComposeEmailModal';
export type { EmailComposerProps } from '@/components/dashboard/business/ComposeEmailModal';
export { default as EmailProviderSelector } from '@/components/shared/EmailProviderSelector';
