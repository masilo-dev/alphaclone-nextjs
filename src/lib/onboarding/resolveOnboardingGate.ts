import { supabase } from '@/lib/supabase';

export type OnboardingGateState = {
  welcomeSeen: boolean;
  onboardingCompleted: boolean;
  tourCompleted: boolean;
  establishedWorkspace: boolean;
};

function welcomeKeys(userId: string) {
  return [`business_welcome_seen_${userId}`, `welcome_seen_${userId}`];
}

function onboardingKey(userId: string) {
  return `onboarding_completed_${userId}`;
}

function tourKey(userId: string) {
  return `business_tour_completed_${userId}`;
}

function markWelcomeSeen(userId: string) {
  for (const key of welcomeKeys(userId)) {
    localStorage.setItem(key, '1');
  }
}

function isWelcomeSeen(userId: string) {
  return welcomeKeys(userId).some(
    (key) => localStorage.getItem(key) === '1' || localStorage.getItem(key) === 'true'
  );
}

/** Sync profile/auth onboarding flags into localStorage for returning users. */
export async function resolveOnboardingGate(
  userId: string,
  tenantId?: string | null,
  userMetadata?: Record<string, unknown> | null
): Promise<OnboardingGateState> {
  if (typeof window === 'undefined') {
    return {
      welcomeSeen: true,
      onboardingCompleted: true,
      tourCompleted: true,
      establishedWorkspace: false,
    };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', userId)
    .maybeSingle();

  const metadataComplete = userMetadata?.onboarding_completed === true;
  if (profile?.onboarding_completed || metadataComplete) {
    localStorage.setItem(onboardingKey(userId), 'true');
  }

  let establishedWorkspace = false;
  if (tenantId) {
    const { count: clientCount } = await supabase
      .from('business_clients')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    const { count: invoiceCount } = await supabase
      .from('business_invoices')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    const { count: leadCount } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    establishedWorkspace =
      (clientCount ?? 0) > 0 || (invoiceCount ?? 0) > 0 || (leadCount ?? 0) > 0;
  }

  if (establishedWorkspace) {
    markWelcomeSeen(userId);
    localStorage.setItem(onboardingKey(userId), 'true');
    localStorage.setItem(tourKey(userId), '1');
  }

  return {
    welcomeSeen: isWelcomeSeen(userId),
    onboardingCompleted: localStorage.getItem(onboardingKey(userId)) === 'true',
    tourCompleted: localStorage.getItem(tourKey(userId)) === '1',
    establishedWorkspace,
  };
}
