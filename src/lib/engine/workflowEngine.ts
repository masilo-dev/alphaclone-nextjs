import { eventBus, DomainEvent } from "./eventBus";
import { jobQueue } from "./jobQueue";

export interface WorkflowCondition {
  field: string; // e.g. "payload.fit_score" or "lead.status"
  operator: "eq" | "neq" | "gte" | "lte" | "contains" | "in";
  value: any;
}

export interface WorkflowAction {
  action_type: "schedule_job" | "emit_event" | "update_entity" | "policy_check";
  params: Record<string, any>;
}

export interface WorkflowStep {
  step_id: string;
  name: string;
  conditions?: WorkflowCondition[];
  actions: WorkflowAction[];
  delay_seconds?: number;
  next_step_id?: string;
}

export interface WorkflowDefinition {
  id: string;
  tenant_id: string;
  name: string;
  trigger_event: string;
  steps: WorkflowStep[];
  is_active: boolean;
}

export class WorkflowEngine {
  private static instance: WorkflowEngine;

  public static getInstance(): WorkflowEngine {
    if (!WorkflowEngine.instance) {
      WorkflowEngine.instance = new WorkflowEngine();
    }
    return WorkflowEngine.instance;
  }

  public init(): void {
    // Subscribe to all domain events to trigger relevant workflows
    eventBus.subscribe("*", async (event: DomainEvent) => {
      await this.handleEvent(event);
    });
    console.log("[WorkflowEngine] Initialized and subscribed to domain events.");
  }

  /**
   * Handle incoming event and wake workflows matching trigger_event.
   */
  public async handleEvent(event: DomainEvent): Promise<void> {
    console.log(`[WorkflowEngine] Evaluating workflows for trigger '${event.event_type}'`);

    // Built-in reactive workflows
    switch (event.event_type) {
      case "lead.created":
        await this.runLeadScoringWorkflow(event);
        break;

      case "lead.qualified":
        await this.runLeadOutreachWorkflow(event);
        break;

      case "email.replied":
        await this.handleEmailRepliedWorkflow(event);
        break;

      case "quote.requested":
        await this.runQuoteRequestedWorkflow(event);
        break;

      case "quote.accepted":
      case "proposal.accepted":
        await this.runContractGenerationWorkflow(event);
        break;

      case "contract.signed":
        await this.runClientOnboardingWorkflow(event);
        break;

      case "social.post.scheduled":
        await this.runSocialPostSchedulingWorkflow(event);
        break;

      default:
        break;
    }
  }

  /**
   * Evaluate conditions array against context data.
   */
  public evaluateConditions(conditions: WorkflowCondition[], context: Record<string, any>): boolean {
    if (!conditions || conditions.length === 0) return true;

    for (const cond of conditions) {
      const actualVal = this.getNestedValue(context, cond.field);
      switch (cond.operator) {
        case "eq":
          if (actualVal !== cond.value) return false;
          break;
        case "neq":
          if (actualVal === cond.value) return false;
          break;
        case "gte":
          if (Number(actualVal) < Number(cond.value)) return false;
          break;
        case "lte":
          if (Number(actualVal) > Number(cond.value)) return false;
          break;
        case "contains":
          if (typeof actualVal === "string" && !actualVal.includes(cond.value)) return false;
          break;
        case "in":
          if (Array.isArray(cond.value) && !cond.value.includes(actualVal)) return false;
          break;
      }
    }
    return true;
  }

  private getNestedValue(obj: any, pathStr: string): any {
    return pathStr.split(".").reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
  }

  // --- STANDARD REPO WORKFLOWS ---

  private async runLeadScoringWorkflow(event: DomainEvent) {
    console.log(`[WorkflowEngine] Running Lead Scoring Workflow for Lead ID ${event.aggregate_id}`);
    await jobQueue.enqueueJob({
      tenant_id: event.tenant_id,
      job_type: "score_and_qualify_lead",
      payload: { lead_id: event.aggregate_id, ...event.payload },
    });
  }

  private async runLeadOutreachWorkflow(event: DomainEvent) {
    console.log(`[WorkflowEngine] Running Outreach Workflow for Lead ID ${event.aggregate_id}`);
    // Step 1: Send initial outreach email
    await jobQueue.enqueueJob({
      tenant_id: event.tenant_id,
      job_type: "send_outreach_email",
      payload: { lead_id: event.aggregate_id, step: 1, ...event.payload },
    });

    // Step 2: Schedule 3-day follow-up check (Delay: 3 days)
    const delay3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    await jobQueue.enqueueJob({
      tenant_id: event.tenant_id,
      job_type: "check_and_send_followup",
      scheduled_at: delay3Days,
      payload: { lead_id: event.aggregate_id, step: 2, thread_id: event.payload.thread_id || event.aggregate_id },
      idempotency_key: `followup_step2_${event.aggregate_id}`,
    });
  }

  private async handleEmailRepliedWorkflow(event: DomainEvent) {
    console.log(`[WorkflowEngine] Lead replied! Auto-cancelling pending follow-up jobs for lead ${event.aggregate_id}`);
    // CANCEL pending follow-up jobs automatically!
    const cancelledCount = await jobQueue.cancelJobsByPayload(event.tenant_id, "lead_id", event.aggregate_id);
    console.log(`[WorkflowEngine] Cancelled ${cancelledCount} follow-up jobs for lead ${event.aggregate_id}`);

    // Trigger intent classification & auto-reply handler
    await jobQueue.enqueueJob({
      tenant_id: event.tenant_id,
      job_type: "classify_and_reply_email",
      payload: { lead_id: event.aggregate_id, reply_body: event.payload.body, ...event.payload },
    });
  }

  private async runQuoteRequestedWorkflow(event: DomainEvent) {
    console.log(`[WorkflowEngine] Running Auto-Quote Workflow for ${event.aggregate_id}`);
    await jobQueue.enqueueJob({
      tenant_id: event.tenant_id,
      job_type: "generate_and_send_quote",
      payload: { lead_id: event.aggregate_id, service_name: event.payload.service_name, ...event.payload },
    });
  }

  private async runContractGenerationWorkflow(event: DomainEvent) {
    console.log(`[WorkflowEngine] Quote/Proposal Accepted! Auto-generating Contract for ${event.aggregate_id}`);
    await jobQueue.enqueueJob({
      tenant_id: event.tenant_id,
      job_type: "generate_contract_from_quote",
      payload: { quote_id: event.aggregate_id, ...event.payload },
    });
  }

  private async runClientOnboardingWorkflow(event: DomainEvent) {
    console.log(`[WorkflowEngine] Contract Signed! Converting Lead to Client & Starting Onboarding for ${event.aggregate_id}`);
    await jobQueue.enqueueJob({
      tenant_id: event.tenant_id,
      job_type: "onboard_signed_client",
      payload: { contract_id: event.aggregate_id, ...event.payload },
    });
  }

  private async runSocialPostSchedulingWorkflow(event: DomainEvent) {
    console.log(`[WorkflowEngine] Social Post Scheduled for ID ${event.aggregate_id}`);
    await jobQueue.enqueueJob({
      tenant_id: event.tenant_id,
      job_type: "publish_social_post",
      scheduled_at: event.payload.scheduled_at,
      payload: { post_id: event.aggregate_id },
      idempotency_key: `publish_social_post_${event.aggregate_id}`,
    });
  }
}

export const workflowEngine = WorkflowEngine.getInstance();
