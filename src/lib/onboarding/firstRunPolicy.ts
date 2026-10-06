/** Missing or failed reads never establish that a returning account is new. */
export function isFirstRunEligible(input: {
  createdAt?: string | null;
  profileComplete?: boolean | null;
  onboardingComplete: boolean;
  guidanceSeen: boolean;
  workspaceVerifiedEmpty: boolean;
  now?: number;
}): boolean {
  const age = (input.now ?? Date.now()) - Date.parse(input.createdAt ?? '');
  return input.profileComplete === false && !input.onboardingComplete &&
    !input.guidanceSeen && input.workspaceVerifiedEmpty &&
    Number.isFinite(age) && age >= 0 && age < 24 * 60 * 60 * 1000;
}
