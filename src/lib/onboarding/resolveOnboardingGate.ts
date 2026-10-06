import { supabase } from '@/lib/supabase';
import { getWalkthroughRecord, setWalkthroughState } from './walkthroughService';
import { isFirstRunEligible } from './firstRunPolicy';

export type OnboardingGateState = {
  welcomeSeen: boolean;
  onboardingCompleted: boolean;
  tourCompleted: boolean;
  establishedWorkspace: boolean;
  firstRunEligible: boolean;
};

const suppressed: OnboardingGateState = {
  welcomeSeen: true, onboardingCompleted: true, tourCompleted: true,
  establishedWorkspace: false, firstRunEligible: false,
};

/** The checklist replaces proactive welcome banners; module help remains passive. */
export function canShowPlatformWelcomeBanner(_userId: string): boolean {
  return false;
}

/** Read durable and legacy state without treating unavailable data as a new account. */
export async function resolveOnboardingGate(
  userId: string,
  tenantId?: string | null,
  userMetadata?: Record<string, unknown> | null
): Promise<OnboardingGateState> {
  if (typeof window === 'undefined' || !userId || !tenantId) return suppressed;
  try {
    const { data: profile, error } = await supabase.from('profiles')
      .select('onboarding_completed, walkthrough_completed, created_at')
      .eq('id', userId).maybeSingle();
    if (error || !profile) return suppressed;

    const readFlag = (key: string) => ['1', 'true'].includes(localStorage.getItem(key) ?? '');
    const onboardingKey = `onboarding_completed_${userId}`;
    const onboardingCompleted = readFlag(onboardingKey) || profile.onboarding_completed === true ||
      userMetadata?.onboarding_completed === true;
    if (onboardingCompleted) localStorage.setItem(onboardingKey, 'true');
    if (profile.walkthrough_completed && getWalkthroughRecord(userId).state !== 'completed') {
      setWalkthroughState(userId, 'completed', undefined, { persistProfile: false });
    }
    const tour = getWalkthroughRecord(userId);
    const tourCompleted = tour.state === 'completed' || tour.state === 'dismissed';
    const welcomeSeen = readFlag(`business_welcome_seen_${userId}`) || readFlag(`welcome_seen_${userId}`);
    // Returning and already-guided users need no extra data reads on navigation.
    if (onboardingCompleted || tourCompleted || welcomeSeen) {
      return { welcomeSeen, onboardingCompleted, tourCompleted, establishedWorkspace: false, firstRunEligible: false };
    }
    const results = await Promise.all(
      ['business_clients', 'business_invoices', 'leads', 'projects'].map(table =>
        supabase.from(table).select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId))
    );
    const establishedWorkspace = results.some(result => !result.error && (result.count ?? 0) > 0);
    const workspaceVerifiedEmpty = results.every(result => !result.error && result.count === 0);
    return {
      welcomeSeen, onboardingCompleted, tourCompleted, establishedWorkspace,
      firstRunEligible: isFirstRunEligible({
        createdAt: profile.created_at, profileComplete: profile.onboarding_completed,
        onboardingComplete: onboardingCompleted, guidanceSeen: welcomeSeen || tour.state !== 'not_started',
        workspaceVerifiedEmpty,
      }),
    };
  } catch {
    // Storage restrictions and failed reads must never cause an onboarding flood.
    return suppressed;
  }
}
