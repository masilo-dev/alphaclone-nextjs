import { activityService } from './activityService';

export type LaunchFunnelStep =
  | 'signup_completed'
  | 'integration_connected'
  | 'first_lead_found'
  | 'first_contact_captured'
  | 'first_deal_created'
  | 'first_post_scheduled';

const STORAGE_KEY = 'ac_launch_funnel_steps_v1';

function readSteps(): Record<LaunchFunnelStep, boolean> {
  if (typeof window === 'undefined') return {} as Record<LaunchFunnelStep, boolean>;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {} as Record<LaunchFunnelStep, boolean>;
    return JSON.parse(raw) as Record<LaunchFunnelStep, boolean>;
  } catch {
    return {} as Record<LaunchFunnelStep, boolean>;
  }
}

function writeSteps(steps: Record<LaunchFunnelStep, boolean>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(steps));
}

export const launchFunnelService = {
  getCompletedSteps(): Record<LaunchFunnelStep, boolean> {
    return readSteps();
  },

  isStepCompleted(step: LaunchFunnelStep): boolean {
    const steps = readSteps();
    return Boolean(steps[step]);
  },

  async completeStep(
    step: LaunchFunnelStep,
    userId?: string,
    tenantId?: string,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    const steps = readSteps();
    if (steps[step]) return;
    steps[step] = true;
    writeSteps(steps);

    if (userId) {
      await activityService.logSystemAction(
        userId,
        'EXECUTE',
        `Launch funnel step completed: ${step}`,
        { step, ...metadata },
        tenantId
      );
    }
  },
};

