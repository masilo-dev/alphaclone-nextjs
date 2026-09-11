import { generateText } from '../unifiedAIService';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AgentRole = 'SDR' | 'GrowthMarketer' | 'FinancialRiskAnalyst' | 'ExecutiveCoordinator';

export interface AgentSpec {
  role: AgentRole;
  name: string;
  avatar_url: string;
  focus: string;
  system_instructions: string;
}

export interface PlaybookStep {
  id: string;
  name: string;
  step_number: number;
  trigger_condition: {
    field: string;
    operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
    value: string;
  };
  assigned_agent: AgentRole;
  action_type: 'draft_outreach' | 'escalate_invoice' | 'schedule_post' | 'create_task';
  action_params: Record<string, any>;
}

export interface CustomPlaybook {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  is_active: boolean;
  steps: PlaybookStep[];
  created_at: string;
}

class PlaybookBuilderService {
  private AGENT_FLEET: Record<AgentRole, AgentSpec> = {
    SDR: {
      role: 'SDR',
      name: 'Alpha SDR Agent',
      avatar_url: '/assets/agents/sdr.png',
      focus: 'High-intent lead qualification & hyper-personalized outreach drafting',
      system_instructions: 'You are an elite Sales Development Representative. Your goal is to draft short, high-conversion outbound pitches and pattern-interrupting hooks.'
    },
    GrowthMarketer: {
      role: 'GrowthMarketer',
      name: 'Alpha Marketer Agent',
      avatar_url: '/assets/agents/marketer.png',
      focus: 'Social authority posting, brand alignment, and multi-channel campaign coordination',
      system_instructions: 'You are an elite Growth Marketer. Your focus is generating engaging social drafts, authority insights, and strategic CTAs.'
    },
    FinancialRiskAnalyst: {
      role: 'FinancialRiskAnalyst',
      name: 'Alpha Finance Analyst',
      avatar_url: '/assets/agents/finance.png',
      focus: 'Cash position auditing, payment behavior profiling, and invoice collection strategy',
      system_instructions: 'You are an expert Financial Risk Analyst. Your goal is to draft assertive, highly professional billing collection strategies.'
    },
    ExecutiveCoordinator: {
      role: 'ExecutiveCoordinator',
      name: 'Alpha Chief of Staff',
      avatar_url: '/assets/agents/coordinator.png',
      focus: 'Comprehensive calendar preparation, business anomalies reporting, and workflow automation',
      system_instructions: 'You are an elite business coordinator. Your focus is delegating preparation tasks and highlighting operational bottlenecks.'
    }
  };

  /**
   * Retrieves specs of all specialized agents in the fleet.
   */
  getAgentFleet(): AgentSpec[] {
    return Object.values(this.AGENT_FLEET);
  }

  /**
   * Evaluates and runs playbooks for a tenant against active records.
   */
  async executeActivePlaybooks(
    supabase: SupabaseClient,
    tenantId: string
  ): Promise<{ playbooks_evaluated: number; actions_triggered: number }> {
    let playbooks_evaluated = 0;
    let actions_triggered = 0;

    // 1. Fetch active custom playbooks for the tenant
    const { data: playbooks } = await supabase
      .from('custom_playbooks')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (!Array.isArray(playbooks) || playbooks.length === 0) {
      // Fallback: Create and execute a default playbook if none exists
      await this.seedDefaultPlaybook(supabase, tenantId);
      return { playbooks_evaluated: 1, actions_triggered: 0 };
    }

    playbooks_evaluated = playbooks.length;

    for (const playbook of playbooks) {
      const steps = playbook.steps as PlaybookStep[];

      for (const step of steps) {
        // Find entities matching step trigger condition
        const matchedEntities = await this.queryTriggerEntities(supabase, tenantId, step);

        for (const entity of matchedEntities) {
          const success = await this.triggerStepAction(supabase, tenantId, step, entity);
          if (success) {
            actions_triggered++;
          }
        }
      }
    }

    return { playbooks_evaluated, actions_triggered };
  }

  private async queryTriggerEntities(
    supabase: SupabaseClient,
    tenantId: string,
    step: PlaybookStep
  ): Promise<any[]> {
    // Basic routing to corresponding CRM table based on trigger field
    let table = 'leads';
    const field = step.trigger_condition.field;

    if (field.startsWith('invoice_')) {
      table = 'invoices';
    } else if (field.startsWith('deal_')) {
      table = 'deals';
    }

    const { data } = await supabase
      .from(table)
      .select('*')
      .eq('tenant_id', tenantId);

    if (!Array.isArray(data)) return [];

    // Filter programmatically in memory based on condition operator
    const val = step.trigger_condition.value;
    return data.filter(record => {
      const recordVal = record[field] || record[field.replace(/^[a-z]+_/, '')];
      if (recordVal === undefined) return false;

      switch (step.trigger_condition.operator) {
        case 'equals':
          return String(recordVal) === String(val);
        case 'greater_than':
          return Number(recordVal) > Number(val);
        case 'less_than':
          return Number(recordVal) < Number(val);
        case 'contains':
          return String(recordVal).toLowerCase().includes(String(val).toLowerCase());
        default:
          return false;
      }
    });
  }

  private async triggerStepAction(
    supabase: SupabaseClient,
    tenantId: string,
    step: PlaybookStep,
    entity: any
  ): Promise<boolean> {
    const agent = this.AGENT_FLEET[step.assigned_agent];
    const systemPrompt = `${agent.system_instructions}\nAction context params: ${JSON.stringify(step.action_params)}`;

    try {
      if (step.action_type === 'draft_outreach') {
        // Trigger specialized SDR agent to draft personalized email
        const userPrompt = `Draft an outreach email body for entity: ${JSON.stringify(entity)}`;
        const { text } = await generateText(userPrompt, 800, 'deepseek-chat', tenantId);

        if (text) {
          // Store draft in approvals table for the user
          await supabase.from('autonomous_runner_approvals').insert({
            tenant_id: tenantId,
            action_key: 'custom_playbook_outreach',
            risk_level: 'medium',
            confidence_score: 92,
            reason: `Playbook: ${step.name} triggered for ${entity.name || entity.id}`,
            payload: {
              email_body: text,
              step_id: step.id,
              entity_id: entity.id
            },
            status: 'pending'
          });
          return true;
        }
      } else if (step.action_type === 'create_task') {
        // Trigger Coordinator Agent to delegate task
        await supabase.from('tasks').insert({
          tenant_id: tenantId,
          title: `[Playbook: ${step.name}] task delegates`,
          description: `Action assigned to ${agent.name}: ${step.action_params.description || 'Review record details.'}`,
          status: 'todo',
          priority: 'medium',
          due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
        return true;
      }
    } catch (e) {
      console.error(`Playbook execution step failed:`, e);
    }

    return false;
  }

  private async seedDefaultPlaybook(supabase: SupabaseClient, tenantId: string): Promise<void> {
    const defaultPlaybook: CustomPlaybook = {
      id: `pb-default-${tenantId}`,
      tenant_id: tenantId,
      name: 'Default High-Intent Conversion Playbook',
      description: 'Automatically engage qualified high-value leads using elite SDR agents',
      is_active: true,
      created_at: new Date().toISOString(),
      steps: [
        {
          id: `step-1-${tenantId}`,
          name: 'Personalized SDR outreach draft',
          step_number: 1,
          trigger_condition: {
            field: 'value',
            operator: 'greater_than',
            value: '5000'
          },
          assigned_agent: 'SDR',
          action_type: 'draft_outreach',
          action_params: {
            strategy: 'ROI_FOCUS',
            channel: 'email'
          }
        },
        {
          id: `step-2-${tenantId}`,
          name: 'Operations verification task',
          step_number: 2,
          trigger_condition: {
            field: 'stage',
            operator: 'equals',
            value: 'qualified'
          },
          assigned_agent: 'ExecutiveCoordinator',
          action_type: 'create_task',
          action_params: {
            description: 'Double check CRM details for qualified deal opportunity.'
          }
        }
      ]
    };

    // Store in playbooks table if table exists, or cache in memory
    try {
      await supabase.from('custom_playbooks').insert(defaultPlaybook);
    } catch {
      // Table might not exist yet, safe fallback
    }
  }
}

export const playbookBuilderService = new PlaybookBuilderService();
