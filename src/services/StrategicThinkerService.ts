import { BusinessSnapshot } from './StrategicAuditService';

export interface StrategicInsight {
    type: 'friction' | 'opportunity' | 'pivot';
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    actionableStep: string;
}

export interface StrategicSessionPlan {
    theme: string;
    summary: string;
    insights: StrategicInsight[];
    nextBestAction: {
        task: string;
        reason: string;
        consequenceOfInaction: string;
    };
    autoReaction?: {
        action: string;
        status: 'queued' | 'executing' | 'needs_approval';
        playbookId?: string;
    };
}

export const strategicThinkerService = {
    /**
     * Analyzes a business snapshot to generate strategic insights and a session plan.
     */
    analyze(snapshot: BusinessSnapshot): StrategicSessionPlan {
        const insights: StrategicInsight[] = [];
        const now = new Date();

        // 1. Analyze Invoices (Revenue Friction)
        const overdueInvoices = snapshot.invoices.filter(i => {
            const due = new Date(i.dueDate);
            return (i.status === 'overdue' || (i.status === 'sent' && due < now));
        });

        if (overdueInvoices.length > 0) {
            insights.push({
                type: 'friction',
                title: 'Revenue Leakage',
                description: `You have ${overdueInvoices.length} invoices past due. This indicates a breakdown in your accounts receivable workflow.`,
                impact: 'high',
                actionableStep: 'Initiate automated payment reminders or personal reach-out for the largest outstanding balance.'
            });
        }

        // 2. Analyze Leads (Funnel Friction)
        const staleLeads = snapshot.leads.filter(l => l.daysStale > 30);
        if (staleLeads.length > 100 && snapshot.deals.length === 0) {
            insights.push({
                type: 'pivot',
                title: 'Conversion Bottleneck',
                description: `With over ${staleLeads.length} leads and zero active deals, your current strategy is focused too much on lead generation and not enough on qualification.`,
                impact: 'high',
                actionableStep: 'Stop new lead generation and run a "Re-engagement Blitz" on the top 10% of stale leads.'
            });
        }

        // ... (rest of insights)

        // Define Theme
        let theme = 'Steady Growth';
        let autoReaction: StrategicSessionPlan['autoReaction'] = undefined;

        if (overdueInvoices.length > 0) {
            theme = 'Recovery & Collection';
            autoReaction = {
                action: `Queueing reminders for ${overdueInvoices.length} overdue invoices.`,
                status: 'needs_approval',
                playbookId: 'invoice-recovery-standard'
            };
        } else if (staleLeads.length > 100) {
            theme = 'Funnel Optimization';
            autoReaction = {
                action: 'Initializing AI Lead Qualification for top 20 stale leads.',
                status: 'queued',
                playbookId: 'lead-qualification-blitz'
            };
        }

        // Next Best Action
        // ... (existing logic)

        return {
            theme,
            summary: `Today's focus is **${theme}**. We need to address the ${insights.filter(i => i.type === 'friction').length} friction points holding back your pipeline velocity.`,
            insights,
            nextBestAction: {
                 task: overdueInvoices.length > 0 ? 'Review and resend overdue invoices.' : 'Qualify top 10 stale leads.',
                 reason: overdueInvoices.length > 0 ? 'Direct revenue recovery is the highest impact activity.' : 'You have a large pool of untapped potential that is currently cooling off.',
                 consequenceOfInaction: overdueInvoices.length > 0 ? 'Stale debt becomes significantly harder to collect after 60 days.' : 'Your sales pipeline will remain empty.'
            },
            autoReaction
        };
    },

    /**
     * Suggests optimal time blocks for the current user based on task priority.
     */
    suggestTimeBlocks(tasks: any[], events: any[]): Array<{ title: string; start: string; end: string; type: 'deep_work' | 'recovery' | 'strategy' }> {
        const suggestions: Array<{ title: string; start: string; end: string; type: 'deep_work' | 'recovery' | 'strategy' }> = [];
        const now = new Date();
        
        // Find high priority uncompleted tasks
        const urgentTasks = tasks.filter(t => t.status !== 'completed' && (t.priority === 'urgent' || t.priority === 'high'));
        
        if (urgentTasks.length > 0) {
            // Suggest a deep work block tomorrow morning if possible
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(9, 0, 0, 0);
            
            const end = new Date(tomorrow);
            end.setHours(11, 0, 0, 0);

            suggestions.push({
                title: `Deep Work: ${urgentTasks[0].title}`,
                start: tomorrow.toISOString(),
                end: end.toISOString(),
                type: 'deep_work'
            });
        }

        return suggestions;
    }
};
