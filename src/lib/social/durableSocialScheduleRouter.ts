/**
 * Route scheduled social publish through Bonnie durable runtime when enabled.
 */

import { isDurableRuntimeEnabled } from '@/lib/bonnie/runtime/types';
import { enqueueSocialPublishTask } from '@/lib/social/socialPublishDurableTask';
import { scheduleSocialEngagementCheck } from '@/lib/social/socialEngagementFollowUp';
import { start } from 'workflow/api';
import { socialScheduleWorkflow } from '@/workflows/social-schedule';

export async function queueScheduledSocialPublish(input: {
  tenantId: string;
  postId: string;
  userId?: string;
}): Promise<{ durable: boolean; run_id: string; task_id?: string; poll_tool: string }> {
  if (isDurableRuntimeEnabled()) {
    const userId = input.userId || input.tenantId;
    const enqueued = await enqueueSocialPublishTask({
      tenantId: input.tenantId,
      userId,
      postId: input.postId,
      idempotencyKey: `social-schedule-${input.postId}`,
    });
    await scheduleSocialEngagementCheck({
      tenantId: input.tenantId,
      postId: input.postId,
      runId: enqueued.runId,
    });
    return {
      durable: true,
      run_id: enqueued.runId,
      task_id: enqueued.taskId,
      poll_tool: 'verify_social_post_published',
    };
  }

  const { runId } = await start(socialScheduleWorkflow, [
    { postId: input.postId, tenantId: input.tenantId },
  ]);
  return {
    durable: false,
    run_id: runId,
    poll_tool: 'verify_social_post_published',
  };
}
