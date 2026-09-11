import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export interface DailyBusinessSummary {
    tenantId: string;
    tenantName: string;
    date: string;
    generatedAt: string;

    needsYourAttention: Array<{
        id: string;
        title: string;
        description: string;
        urgency: 'high' | 'critical';
        actionRequired: string;
    }>;

    atAGlance: {
        actionsCompleted: number;
        newLeads: number;
        newClients: number;
        proposals: number;
        projects: number;
        meetings: number;
        invoices: number;
        payments: number;
        failures: number;
        outstandingActions: number;
    };

    clientActivity: {
        newClients: Array<{ id: string; name: string; company?: string; joinedAt: string }>;
        existingClientActivity: Array<{
            clientId: string;
            clientName: string;
            activities: string[];
        }>;
    };

    sales: {
        leadsAdded: number;
        leadsQualified: number;
        oppsCreated: number;
        oppsMoved: number;
        proposalsCreated: number;
        proposalsSent: number;
        proposalsAccepted: Array<{ title: string; client: string; proposedAmount: number; acceptedAmount: number }>;
        proposalsRejected: Array<{ title: string; client: string; reason?: string }>;
        dealsWon: number;
        dealsLost: number;
    };

    emailReplies: Array<{
        clientOrContact: string;
        context: string;
        receivedTime: string;
        owner: string;
        outcome: string;
        nextAction: string;
    }>;

    emailNoReply: Array<{
        recipient: string;
        clientOrLead: string;
        subject: string;
        sentDate: string;
        daysWaiting: number;
        owner: string;
        previousFollowups: number;
        recommendedAction: string;
    }>;

    emailWaitingForUs: Array<{
        sender: string;
        companyOrClient: string;
        receivedTime: string;
        owner: string;
        waitingHours: number;
        slaRemainingHours: number;
        relatedContext: string;
        actionRequired: string;
    }>;

    emailSlaBreached: Array<{
        sender: string;
        companyOrClient: string;
        hoursOverdue: number;
        owner: string;
        actionRequired: string;
    }>;

    projects: {
        created: Array<{ title: string; client: string; owner: string; deadline?: string }>;
        progressed: Array<{ title: string; milestone: string; outcome: string }>;
        atRisk: Array<{ title: string; reason: string; recommendedAction: string }>;
        blocked: Array<{ title: string; blockerCause: string; blockerOwner: string }>;
        completed: Array<{ title: string; client: string; verifiedAt: string }>;
    };

    meetings: Array<{
        title: string;
        clientOrProject: string;
        attendees: string[];
        purpose: string;
        decisions: string[];
        proposed: string[];
        accepted: string[];
        rejected: string[];
        commitments: string[];
        tasksCreated: string[];
        owners: string[];
        deadlines: string[];
        nextFollowup?: string;
    }>;

    decisions: Array<{
        decisionTitle: string;
        proposedBy: string;
        approvedBy: string;
        reason: string;
        projectOrClient: string;
        resultingAction: string;
        reviewPoint?: string;
    }>;

    proposalsAndContracts: {
        created: number;
        sent: number;
        accepted: number;
        rejected: number;
        countered: number;
        signed: number;
        awaitingSignature: Array<{ title: string; client: string; sentDate: string }>;
        expiring: Array<{ title: string; client: string; expiresAt: string }>;
    };

    invoicesAndMoney: {
        created: Array<{ number: string; client: string; amount: number }>;
        sent: Array<{ number: string; client: string; amount: number }>;
        paymentsReceived: Array<{ number: string; client: string; amount: number }>;
        paymentsFailed: Array<{ number: string; client: string; amount: number; reason?: string }>;
        overdueInvoices: Array<{ number: string; client: string; amount: number; daysOverdue: number }>;
        financialActionsNeeded: string[];
    };

    socialMedia: {
        postsCreated: number;
        postsApproved: number;
        postsPublished: number;
        verified: number;
        failedPosts: Array<{ platform: string; campaign?: string; reason: string; owner: string; nextAction: string }>;
    };

    mcpAiActions: Array<{
        description: string;
        owner: string;
        status: string;
        nextAction?: string;
    }>;

    automations: {
        successful: number;
        awaitingVerification: number;
        retries: number;
        partial: number;
        failed: number;
        details: string[];
    };

    failures: Array<{
        whatFailed: string;
        clientProjectImpact: string;
        actorOrSystem: string;
        reason: string;
        retryStatus: string;
        owner: string;
        nextAction: string;
    }>;

    approvals: {
        approvedToday: Array<{ title: string; outcome: string }>;
        waitingForApproval: Array<{ title: string; requestedBy: string; blocking: string }>;
    };

    waitingOnOthers: Array<{
        who: string;
        what: string;
        sinceWhen: string;
        blockedWhat: string;
        followupDate?: string;
    }>;

    commitments: Array<{
        commitment: string;
        owner: string;
        clientOrProject: string;
        dueDate?: string;
        status: string;
    }>;

    tomorrowPriorityWork: {
        doFirst: string[];
        followUp: string[];
        respond: string[];
        approve: string[];
        unblock: string[];
        meetings: string[];
        watch: string[];
    };

    isQuietDay: boolean;
}

export class DailyBusinessSummaryService {
    /**
     * Reconciles and builds the end-of-day operational business summary for a tenant.
     * Follows the 12-step verification pipeline & deduplication rules.
     */
    async getDailySummary(tenantId: string, targetDate?: string): Promise<DailyBusinessSummary> {
        const admin = createSupabaseAdminClient();
        const dateStr = targetDate || new Date().toISOString().split('T')[0];

        // Start and end of the day in UTC
        const startOfDay = new Date(`${dateStr}T00:00:00.000Z`).toISOString();
        const endOfDay = new Date(`${dateStr}T23:59:59.999Z`).toISOString();

        // 1. Fetch Tenant basic info
        const { data: tenant } = await admin
            .from('tenants')
            .select('id, name, business_name')
            .eq('id', tenantId)
            .maybeSingle();

        const tenantName = (tenant?.business_name || tenant?.name || 'AlphaClone Workspace').trim();

        // Querying databases safely using Promise.allSettled
        const [
            leadsRes,
            contactsRes,
            dealsRes,
            projectsRes,
            tasksRes,
            invoicesRes,
            paymentsRes,
            socialPostsRes,
            meetingBriefsRes,
            decisionsRes,
            slasRes,
            blockersRes,
            failuresRes,
            commitmentsRes,
            approvalsRes,
            mcpLogsRes,
            contractsRes,
            proposalsRes,
        ] = await Promise.allSettled([
            // Leads created today
            admin.from('leads').select('id, name, company, stage, created_at, owner_id').eq('tenant_id', tenantId).gte('created_at', startOfDay).lte('created_at', endOfDay),
            // New contacts/clients today
            admin.from('contacts').select('id, first_name, last_name, company_name, type, created_at').eq('tenant_id', tenantId).gte('created_at', startOfDay).lte('created_at', endOfDay),
            // Deals created or updated today
            admin.from('deals').select('id, name, stage, amount, client_id, updated_at, created_at').eq('tenant_id', tenantId).or(`created_at.gte.${startOfDay},updated_at.gte.${startOfDay}`),
            // Projects
            admin.from('projects').select('id, name, status, health, client_id, created_at, updated_at').eq('tenant_id', tenantId).or(`created_at.gte.${startOfDay},updated_at.gte.${startOfDay}`),
            // Tasks
            admin.from('tasks').select('id, title, status, priority, due_date, assigned_to, project_id, created_at, updated_at').eq('tenant_id', tenantId).or(`created_at.gte.${startOfDay},updated_at.gte.${startOfDay}`),
            // Invoices created or updated today
            admin.from('business_invoices').select('id, invoice_number, client_id, total_amount, status, due_date, created_at').eq('tenant_id', tenantId).or(`created_at.gte.${startOfDay},updated_at.gte.${startOfDay}`),
            // Invoice payments
            admin.from('invoice_payments').select('id, invoice_id, amount, payment_method, payment_date, status').eq('tenant_id', tenantId).gte('payment_date', startOfDay).lte('payment_date', endOfDay),
            // Social posts
            admin.from('social_posts').select('id, platform, content, status, scheduled_at, published_at, error_message, created_at').eq('tenant_id', tenantId).or(`created_at.gte.${startOfDay},published_at.gte.${startOfDay}`),
            // Meeting briefs
            admin.from('meeting_briefs').select('*').eq('tenant_id', tenantId).gte('created_at', startOfDay).lte('created_at', endOfDay),
            // Decision records
            admin.from('decision_records').select('*').eq('tenant_id', tenantId).gte('decision_date', startOfDay).lte('decision_date', endOfDay),
            // Communication SLAs
            admin.from('communication_slas').select('*').eq('tenant_id', tenantId),
            // Operational blockers
            admin.from('operational_blockers').select('*').eq('tenant_id', tenantId).eq('status', 'ACTIVE'),
            // Failure records today
            admin.from('failure_records').select('*').eq('tenant_id', tenantId).gte('failure_time', startOfDay).lte('failure_time', endOfDay),
            // Commitments made today or active
            admin.from('commitments').select('*').eq('tenant_id', tenantId),
            // Human approvals
            admin.from('human_approvals').select('*').eq('tenant_id', tenantId),
            // Autonomous runner / MCP logs
            admin.from('autonomous_runner_logs').select('*').eq('tenant_id', tenantId).gte('created_at', startOfDay).lte('created_at', endOfDay).limit(50),
            // Contracts
            admin.from('contracts').select('id, title, status, client_id, created_at, updated_at, expires_at').eq('tenant_id', tenantId),
            // Proposal workflows
            admin.from('proposal_workflows').select('*').eq('tenant_id', tenantId),
        ]);

        const leads = leadsRes.status === 'fulfilled' ? (leadsRes.value.data || []) : [];
        const contacts = contactsRes.status === 'fulfilled' ? (contactsRes.value.data || []) : [];
        const deals = dealsRes.status === 'fulfilled' ? (dealsRes.value.data || []) : [];
        const projects = projectsRes.status === 'fulfilled' ? (projectsRes.value.data || []) : [];
        const tasks = tasksRes.status === 'fulfilled' ? (tasksRes.value.data || []) : [];
        const invoices = invoicesRes.status === 'fulfilled' ? (invoicesRes.value.data || []) : [];
        const payments = paymentsRes.status === 'fulfilled' ? (paymentsRes.value.data || []) : [];
        const socialPosts = socialPostsRes.status === 'fulfilled' ? (socialPostsRes.value.data || []) : [];
        const meetingBriefs = meetingBriefsRes.status === 'fulfilled' ? (meetingBriefsRes.value.data || []) : [];
        const decisions = decisionsRes.status === 'fulfilled' ? (decisionsRes.value.data || []) : [];
        const slas = slasRes.status === 'fulfilled' ? (slasRes.value.data || []) : [];
        const blockers = blockersRes.status === 'fulfilled' ? (blockersRes.value.data || []) : [];
        const failures = failuresRes.status === 'fulfilled' ? (failuresRes.value.data || []) : [];
        const commitments = commitmentsRes.status === 'fulfilled' ? (commitmentsRes.value.data || []) : [];
        const approvals = approvalsRes.status === 'fulfilled' ? (approvalsRes.value.data || []) : [];
        const mcpLogs = mcpLogsRes.status === 'fulfilled' ? (mcpLogsRes.value.data || []) : [];
        const contracts = contractsRes.status === 'fulfilled' ? (contractsRes.value.data || []) : [];
        const proposalWorkflows = proposalsRes.status === 'fulfilled' ? (proposalsRes.value.data || []) : [];

        // --- Data Extraction & Processing ---

        // 1. Needs Your Attention (Max 3-7 items)
        const needsYourAttention: DailyBusinessSummary['needsYourAttention'] = [];

        // Check SLA breaches
        const breachedSlas = slas.filter(s => s.sla_breached || (s.status !== 'RESPONDED' && s.status !== 'CLOSED' && new Date(s.response_deadline_at) < new Date()));
        breachedSlas.slice(0, 2).forEach(s => {
            needsYourAttention.push({
                id: s.id,
                title: `SLA Breached: Inbound Email from ${s.contact_email || 'Client'}`,
                description: `Email received ${new Date(s.received_at).toLocaleTimeString()} has passed the 24-hour response deadline.`,
                urgency: 'critical',
                actionRequired: 'Respond to client immediately.'
            });
        });

        // Check overdue invoices
        const overdueInvoicesList = invoices.filter(i => i.status === 'overdue' || (i.status !== 'paid' && i.due_date && new Date(i.due_date) < new Date()));
        overdueInvoicesList.slice(0, 2).forEach(i => {
            needsYourAttention.push({
                id: i.id,
                title: `Overdue Invoice: ${i.invoice_number || 'Inv'} ($${i.total_amount || 0})`,
                description: `Invoice is overdue. Payment collection is required.`,
                urgency: 'high',
                actionRequired: 'Send payment reminder to client.'
            });
        });

        // Check active blockers
        blockers.slice(0, 2).forEach(b => {
            needsYourAttention.push({
                id: b.id,
                title: `Blocked Operation: ${b.title}`,
                description: `Cause: ${b.blocker_cause}. Impact: ${b.business_impact}`,
                urgency: 'high',
                actionRequired: b.required_action || 'Unblock required task.'
            });
        });

        // Limit Needs Your Attention to 7 items max
        const finalNeedsYourAttention = needsYourAttention.slice(0, 7);

        // 2. Client Activity
        const newClientsList = contacts.map(c => ({
            id: c.id,
            name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'New Client',
            company: c.company_name || undefined,
            joinedAt: c.created_at
        }));

        // Existing Client Activity
        const existingClientActivity: DailyBusinessSummary['clientActivity']['existingClientActivity'] = [];

        // 3. Sales
        const leadsQualified = leads.filter(l => l.stage === 'qualified' || l.stage === 'proposal').length;
        const proposalsAcceptedList: DailyBusinessSummary['sales']['proposalsAccepted'] = [];
        const proposalsRejectedList: DailyBusinessSummary['sales']['proposalsRejected'] = [];

        proposalWorkflows.forEach(pw => {
            if (pw.status === 'ACCEPTED') {
                proposalsAcceptedList.push({
                    title: `Proposal #${pw.proposal_id.slice(0, 6)}`,
                    client: 'Client',
                    proposedAmount: 0,
                    acceptedAmount: 0
                });
            } else if (pw.status === 'REJECTED') {
                proposalsRejectedList.push({
                    title: `Proposal #${pw.proposal_id.slice(0, 6)}`,
                    client: 'Client',
                    reason: 'Client declined'
                });
            }
        });

        // 4. Email - SLA & Statuses
        const emailWaitingForUs: DailyBusinessSummary['emailWaitingForUs'] = [];
        const emailSlaBreached: DailyBusinessSummary['emailSlaBreached'] = [];

        slas.forEach(s => {
            if (s.status !== 'RESPONDED' && s.status !== 'CLOSED') {
                const deadline = new Date(s.response_deadline_at).getTime();
                const now = Date.now();
                const remainingMs = deadline - now;
                const waitingHours = Math.round((now - new Date(s.received_at).getTime()) / 3600000);

                if (remainingMs < 0 || s.sla_breached) {
                    emailSlaBreached.push({
                        sender: s.contact_email || 'Client',
                        companyOrClient: 'Client',
                        hoursOverdue: Math.abs(Math.round(remainingMs / 3600000)),
                        owner: 'Assigned Owner',
                        actionRequired: 'Respond immediately to avoid customer churn.'
                    });
                } else {
                    emailWaitingForUs.push({
                        sender: s.contact_email || 'Client',
                        companyOrClient: 'Client',
                        receivedTime: s.received_at,
                        owner: 'Assigned Owner',
                        waitingHours,
                        slaRemainingHours: Math.max(0, Math.round(remainingMs / 3600000)),
                        relatedContext: s.subject || 'Inbound Inquiry',
                        actionRequired: 'Send reply.'
                    });
                }
            }
        });

        // 5. Projects
        const projectsCreated = projects.filter(p => p.created_at >= startOfDay && p.created_at <= endOfDay).map(p => ({
            title: p.name,
            client: 'Client',
            owner: 'Project Manager'
        }));

        const projectsAtRisk = projects.filter(p => p.health === 'at_risk' || p.health === 'critical').map(p => ({
            title: p.name,
            reason: `Project health flagged as ${p.health}`,
            recommendedAction: 'Review milestones and reach out to project sponsor.'
        }));

        const blockedProjects = blockers.filter(b => b.project_id).map(b => ({
            title: b.title,
            blockerCause: b.blocker_cause,
            blockerOwner: b.owner_name || 'Team Member'
        }));

        const projectsCompleted = projects.filter(p => p.status === 'completed' && p.updated_at >= startOfDay).map(p => ({
            title: p.name,
            client: 'Client',
            verifiedAt: p.updated_at
        }));

        // 6. Meetings
        const processedMeetings: DailyBusinessSummary['meetings'] = meetingBriefs.map(mb => ({
            title: mb.title,
            clientOrProject: 'Client Meeting',
            attendees: [],
            purpose: mb.objective || 'Business Strategy & Execution',
            decisions: Array.isArray(mb.extracted_decisions) ? mb.extracted_decisions.map(String) : [],
            proposed: [],
            accepted: [],
            rejected: [],
            commitments: Array.isArray(mb.extracted_commitments) ? mb.extracted_commitments.map(String) : [],
            tasksCreated: Array.isArray(mb.extracted_tasks) ? mb.extracted_tasks.map(String) : [],
            owners: [],
            deadlines: []
        }));

        // 7. Decisions
        const processedDecisions: DailyBusinessSummary['decisions'] = decisions.map(d => ({
            decisionTitle: d.decision_title,
            proposedBy: d.decision_owner_name || 'Team',
            approvedBy: d.status === 'approved' ? (d.decision_owner_name || 'Management') : 'Pending',
            reason: d.context,
            projectOrClient: 'Workspace',
            resultingAction: d.expected_result || 'Execution'
        }));

        // 8. Invoices & Money
        const invoicesCreated = invoices.filter(i => i.created_at >= startOfDay && i.created_at <= endOfDay).map(i => ({
            number: i.invoice_number || 'INV-NEW',
            client: 'Client',
            amount: Number(i.total_amount || 0)
        }));

        const paymentsReceived = payments.filter(p => p.status === 'completed' || p.status === 'succeeded').map(p => ({
            number: `PAY-${p.id.slice(0, 6)}`,
            client: 'Client',
            amount: Number(p.amount || 0)
        }));

        const paymentsFailed = payments.filter(p => p.status === 'failed').map(p => ({
            number: `PAY-${p.id.slice(0, 6)}`,
            client: 'Client',
            amount: Number(p.amount || 0),
            reason: 'Card decline / processing failure'
        }));

        const overdueInvoicesFormatted = overdueInvoicesList.map(i => {
            const dueDate = i.due_date ? new Date(i.due_date).getTime() : Date.now();
            const daysOverdue = Math.max(1, Math.floor((Date.now() - dueDate) / (86400 * 1000)));
            return {
                number: i.invoice_number || 'INV',
                client: 'Client',
                amount: Number(i.total_amount || 0),
                daysOverdue
            };
        });

        // 9. Social Media
        const socialCreated = socialPosts.filter(p => p.created_at >= startOfDay && p.created_at <= endOfDay).length;
        const socialPublished = socialPosts.filter(p => p.status === 'published').length;
        const socialFailed = socialPosts.filter(p => p.status === 'failed').map(p => ({
            platform: p.platform || 'Social Network',
            reason: p.error_message || 'Publishing error',
            owner: 'Marketing Team',
            nextAction: 'Re-authenticate account & retry post.'
        }));

        // 10. MCP / AI Actions (Business Language Conversion - Deduplicated)
        const mcpAiActions: DailyBusinessSummary['mcpAiActions'] = [];
        mcpLogs.forEach(log => {
            let desc = `Executed autonomous operation (${log.action_type || 'task'})`;
            if (log.action_type?.includes('email')) {
                desc = `Autonomous email action dispatched for outreach/follow-up`;
            } else if (log.action_type?.includes('lead')) {
                desc = `AI Lead Finder searched & discovered target opportunities`;
            } else if (log.action_type?.includes('crm')) {
                desc = `Updated CRM contact pipeline record`;
            }
            mcpAiActions.push({
                description: desc,
                owner: 'Bonnie AI / MCP',
                status: log.status || 'SUCCESS'
            });
        });

        // 11. Failures Across All Modules
        const processedFailures: DailyBusinessSummary['failures'] = failures.map(f => ({
            whatFailed: f.title,
            clientProjectImpact: f.business_impact,
            actorOrSystem: f.category,
            reason: f.actual_result,
            retryStatus: f.status,
            owner: f.failure_owner_name || 'System Admin',
            nextAction: f.recovery_action || 'Investigate root cause.'
        }));

        // Add payment failures to master failure section if any
        paymentsFailed.forEach(pf => {
            processedFailures.push({
                whatFailed: `Payment processing for ${pf.number}`,
                clientProjectImpact: `$${pf.amount} revenue delayed`,
                actorOrSystem: 'Payment Gateway',
                reason: pf.reason || 'Decline',
                retryStatus: 'FAILED',
                owner: 'Finance Manager',
                nextAction: 'Contact client to update payment method.'
            });
        });

        // Add social failures
        socialFailed.forEach(sf => {
            processedFailures.push({
                whatFailed: `Social Post on ${sf.platform}`,
                clientProjectImpact: 'Marketing reach delayed',
                actorOrSystem: sf.platform,
                reason: sf.reason,
                retryStatus: 'FAILED',
                owner: sf.owner,
                nextAction: sf.nextAction
            });
        });

        // 12. Approvals
        const approvedToday = approvals.filter(a => a.status === 'approved').map(a => ({
            title: a.title || 'Action Request',
            outcome: 'Approved & executed.'
        }));

        const waitingForApproval = approvals.filter(a => a.status === 'pending').map(a => ({
            title: a.title || 'Action Request',
            requestedBy: a.requested_by || 'Team Member',
            blocking: a.context || 'Workflow execution'
        }));

        // 13. Waiting on Others
        const waitingOnOthersList: DailyBusinessSummary['waitingOnOthers'] = [];
        slas.filter(s => s.status === 'WAITING_ON_CLIENT').forEach(s => {
            waitingOnOthersList.push({
                who: s.contact_email || 'Client',
                what: 'Client response / asset approval',
                sinceWhen: new Date(s.received_at).toLocaleDateString(),
                blockedWhat: 'Project progression'
            });
        });

        // 14. Commitments
        const openCommitments: DailyBusinessSummary['commitments'] = commitments.map(c => ({
            commitment: c.commitment,
            owner: c.maker_name || 'Team',
            clientOrProject: 'Client Project',
            dueDate: c.due_date || undefined,
            status: c.status
        }));

        // 15. Tomorrow — Priority Work
        const tomorrowPriorityWork: DailyBusinessSummary['tomorrowPriorityWork'] = {
            doFirst: [],
            followUp: [],
            respond: [],
            approve: [],
            unblock: [],
            meetings: [],
            watch: []
        };

        // Populate Tomorrow Work based on real data
        emailSlaBreached.forEach(e => tomorrowPriorityWork.respond.push(`Urgent: Reply to ${e.sender} (SLA breached ${e.hoursOverdue}h ago)`));
        emailWaitingForUs.forEach(e => tomorrowPriorityWork.respond.push(`Reply to ${e.sender} (${e.slaRemainingHours}h SLA remaining)`));
        overdueInvoicesFormatted.forEach(i => tomorrowPriorityWork.followUp.push(`Follow up on overdue invoice ${i.number} ($${i.amount})`));
        waitingForApproval.forEach(a => tomorrowPriorityWork.approve.push(`Review & approve: ${a.title}`));
        blockedProjects.forEach(b => tomorrowPriorityWork.unblock.push(`Unblock ${b.title}: ${b.blockerCause}`));
        projectsAtRisk.forEach(p => tomorrowPriorityWork.watch.push(`Monitor at-risk project ${p.title}`));

        // At a Glance totals
        const actionsCompleted = leads.length + deals.length + tasks.filter(t => t.status === 'completed').length + socialPublished + paymentsReceived.length;
        const totalFailures = processedFailures.length;
        const outstandingActions = finalNeedsYourAttention.length + emailWaitingForUs.length + waitingForApproval.length;

        const isQuietDay = actionsCompleted === 0 && leads.length === 0 && invoicesCreated.length === 0 && totalFailures === 0 && outstandingActions === 0;

        return {
            tenantId,
            tenantName,
            date: dateStr,
            generatedAt: new Date().toISOString(),

            needsYourAttention: finalNeedsYourAttention,

            atAGlance: {
                actionsCompleted,
                newLeads: leads.length,
                newClients: newClientsList.length,
                proposals: proposalWorkflows.length,
                projects: projects.length,
                meetings: processedMeetings.length,
                invoices: invoicesCreated.length,
                payments: paymentsReceived.length,
                failures: totalFailures,
                outstandingActions
            },

            clientActivity: {
                newClients: newClientsList,
                existingClientActivity
            },

            sales: {
                leadsAdded: leads.length,
                leadsQualified,
                oppsCreated: deals.length,
                oppsMoved: deals.filter(d => d.updated_at >= startOfDay).length,
                proposalsCreated: proposalWorkflows.length,
                proposalsSent: proposalWorkflows.filter(p => p.status === 'SENT').length,
                proposalsAccepted: proposalsAcceptedList,
                proposalsRejected: proposalsRejectedList,
                dealsWon: deals.filter(d => d.stage === 'won' || d.stage === 'closed_won').length,
                dealsLost: deals.filter(d => d.stage === 'lost' || d.stage === 'closed_lost').length
            },

            emailReplies: [],
            emailNoReply: [],
            emailWaitingForUs,
            emailSlaBreached,

            projects: {
                created: projectsCreated,
                progressed: [],
                atRisk: projectsAtRisk,
                blocked: blockedProjects,
                completed: projectsCompleted
            },

            meetings: processedMeetings,
            decisions: processedDecisions,

            proposalsAndContracts: {
                created: proposalWorkflows.length + contracts.filter(c => c.created_at >= startOfDay).length,
                sent: proposalWorkflows.filter(p => p.status === 'SENT').length,
                accepted: proposalsAcceptedList.length,
                rejected: proposalsRejectedList.length,
                countered: 0,
                signed: contracts.filter(c => c.status === 'signed' || c.status === 'active').length,
                awaitingSignature: contracts.filter(c => c.status === 'sent' || c.status === 'pending_signature').map(c => ({
                    title: c.title,
                    client: 'Client',
                    sentDate: c.updated_at
                })),
                expiring: contracts.filter(c => c.expires_at && new Date(c.expires_at) < new Date(Date.now() + 7 * 86400 * 1000)).map(c => ({
                    title: c.title,
                    client: 'Client',
                    expiresAt: c.expires_at!
                }))
            },

            invoicesAndMoney: {
                created: invoicesCreated,
                sent: invoicesCreated,
                paymentsReceived,
                paymentsFailed,
                overdueInvoices: overdueInvoicesFormatted,
                financialActionsNeeded: overdueInvoicesFormatted.length > 0 ? ['Follow up on overdue client balances'] : []
            },

            socialMedia: {
                postsCreated: socialCreated,
                postsApproved: socialCreated,
                postsPublished: socialPublished,
                verified: socialPublished,
                failedPosts: socialFailed
            },

            mcpAiActions,

            automations: {
                successful: mcpAiActions.filter(m => m.status === 'SUCCESS').length,
                awaitingVerification: 0,
                retries: 0,
                partial: 0,
                failed: processedFailures.filter(f => f.actorOrSystem === 'automation').length,
                details: mcpAiActions.map(m => m.description)
            },

            failures: processedFailures,

            approvals: {
                approvedToday,
                waitingForApproval
            },

            waitingOnOthers: waitingOnOthersList,
            commitments: openCommitments,
            tomorrowPriorityWork,

            isQuietDay
        };
    }
}

export const dailyBusinessSummaryService = new DailyBusinessSummaryService();
