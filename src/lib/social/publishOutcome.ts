export type DurablePublishOutcome = 'published' | 'reconciled' | 'outcome_unknown' | 'failed';

export function resolveDurablePublishOutcome(input: {
  providerConfirmedPost: boolean;
  providerOutcomeIsAmbiguous: boolean;
  reconciledProviderReference?: string | null;
}): DurablePublishOutcome {
  if (input.providerConfirmedPost) return 'published';
  if (input.providerOutcomeIsAmbiguous) {
    return input.reconciledProviderReference ? 'reconciled' : 'outcome_unknown';
  }
  return 'failed';
}

export function canAutomaticallyRetryPublish(input: {
  status: string | null | undefined;
  providerReference?: string | null;
}): boolean {
  if (input.providerReference) return false;
  return !['publishing', 'outcome_unknown', 'published'].includes(String(input.status || ''));
}
