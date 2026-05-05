import { serve } from "workflow/nextjs";
export const dynamic = 'force-dynamic';
import { invoiceLifecycleWorkflow } from "@/../workflows/invoice-lifecycle";
import { contractLifecycleWorkflow } from "@/../workflows/contract-lifecycle";
import { leadFindingWorkflow } from "@/../workflows/lead-finding";
import { leadNurtureWorkflow } from "@/../workflows/lead-nurture";
import { dealStageWorkflow } from "@/../workflows/deal-stage";
import { socialScheduleWorkflow } from "@/../workflows/social-schedule";
import { emailCampaignWorkflow } from "@/../workflows/email-campaign";
import { projectKickoffWorkflow } from "@/../workflows/project-kickoff";
import { videoRoomOrchestrationWorkflow } from "@/../workflows/video-room-orchestration";
import { userOnboardingWorkflow } from "@/../workflows/user-onboarding";
import { mcpAgentWorkflow } from "@/../workflows/mcp-agent";

export const { POST, GET } = serve({
  workflows: [
    invoiceLifecycleWorkflow,
    contractLifecycleWorkflow,
    leadFindingWorkflow,
    leadNurtureWorkflow,
    dealStageWorkflow,
    socialScheduleWorkflow,
    emailCampaignWorkflow,
    projectKickoffWorkflow,
    videoRoomOrchestrationWorkflow,
    userOnboardingWorkflow,
    mcpAgentWorkflow
  ],
});
