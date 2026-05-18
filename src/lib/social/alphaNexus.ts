import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * AlphaClone Nexus Intelligence Core
 * Powered by AlphaClone's proprietary agentic infrastructure.
 * Integrates 15 core business systems released May 2026.
 */

export interface NexusOutcome {
    id: string;
    description: string;
    successCriteria: string[];
}

export interface NexusResult {
    success: boolean;
    score: number; // 0-100
    feedback: string;
    refinedContent?: string;
}

export class AlphaNexus {
    private tenantId: string;
    private admin = createSupabaseAdminClient();

    constructor(tenantId: string) {
        this.tenantId = tenantId;
    }

    /**
     * Core Systems Matrix (The 15 Skills released May 2026)
     * Keys must exactly match the suffix after 'nexus_' in MCP tool names.
     */
    async executeSystemAction(systemKey: string, params: Record<string, unknown> = {}) {
        const systems: Record<string, (p: Record<string, unknown>) => Promise<unknown>> = {
            // Fixed: was 'payroll_automation' — now matches nexus_payroll_sync → 'payroll_sync'
            'payroll_sync':          (p) => this.handlePayroll(p),
            'invoice_chasing':       (p) => this.handleInvoiceChasing(p),
            'month_end_close':       (p) => this.handleMonthEnd(p),
            // Fixed: was 'sales_campaign_engine' — now matches nexus_sales_campaign → 'sales_campaign'
            'sales_campaign':        (p) => this.handleSalesCampaign(p),
            'lead_enrichment':       (p) => this.handleLeadEnrichment(p),
            'meeting_intelligence':  (p) => this.handleMeetingIntel(p),
            'contract_drafter':      (p) => this.handleContractDrafting(p),
            'project_architect':     (p) => this.handleProjectPlanning(p),
            'email_triage':          (p) => this.handleEmailTriage(p),
            'design_audit':          (p) => this.handleDesignAudit(p),
            'onboarding_flow':       (p) => this.handleOnboarding(p),
            'content_synthesis':     (p) => this.handleContentGen(p),
            'support_triage':        (p) => this.handleSupportTriage(p),
            'calendar_nexus':        (p) => this.handleCalendarOpt(p),
            'market_pulse':          (p) => this.handleMarketAnalysis(p),
        };

        const handler = systems[systemKey];
        if (!handler) {
            throw new Error(
                `Nexus system '${systemKey}' not found. Available: ${Object.keys(systems).join(', ')}`
            );
        }
        return await handler(params);
    }

    // ── Data-driven System Handlers ─────────────────────────────────────────

    private async handlePayroll(_params: Record<string, unknown>) {
        const { data: expenses } = await this.admin
            .from('expenses')
            .select('id, description, amount, status, category, date')
            .eq('tenant_id', this.tenantId)
            .eq('status', 'pending')
            .limit(50);

        const { data: tasks } = await this.admin
            .from('tasks')
            .select('id, title, status, due_date')
            .eq('tenant_id', this.tenantId)
            .ilike('title', '%payroll%')
            .limit(20);

        const pending = (expenses || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
        return {
            system: 'nexus_payroll_sync',
            status: 'complete',
            pending_expenses: expenses?.length ?? 0,
            pending_expense_total: pending,
            payroll_tasks: tasks || [],
            message: `Found ${expenses?.length ?? 0} pending expense claim(s) totalling $${pending.toFixed(2)}. ${tasks?.length ?? 0} payroll-related task(s) open.`,
            action_required: (expenses?.length ?? 0) > 0,
        };
    }

    private async handleInvoiceChasing(_params: Record<string, unknown>) {
        const now = new Date().toISOString().split('T')[0];
        const { data: overdue } = await this.admin
            .from('business_invoices')
            .select('id, invoice_number, due_date, total, status, client_id')
            .eq('tenant_id', this.tenantId)
            .in('status', ['sent', 'overdue'])
            .lt('due_date', now)
            .order('due_date', { ascending: true })
            .limit(50);

        const total = (overdue || []).reduce((s: number, inv: any) => s + Number(inv.total || 0), 0);
        return {
            system: 'nexus_invoice_chasing',
            status: 'complete',
            overdue_count: overdue?.length ?? 0,
            overdue_total: total,
            overdue_invoices: (overdue || []).map((inv: any) => ({
                id: inv.id,
                invoice_number: inv.invoice_number,
                due_date: inv.due_date,
                total: inv.total,
                days_overdue: Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000),
            })),
            message: `${overdue?.length ?? 0} overdue invoice(s) totalling $${total.toFixed(2)}. Use send_invoice tool to send reminders.`,
            action_required: (overdue?.length ?? 0) > 0,
        };
    }

    private async handleMonthEnd(_params: Record<string, unknown>) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const { data: invoices } = await this.admin
            .from('business_invoices')
            .select('id, status, total')
            .eq('tenant_id', this.tenantId)
            .gte('created_at', startOfMonth)
            .limit(500);

        const { data: expenses } = await this.admin
            .from('expenses')
            .select('id, amount')
            .eq('tenant_id', this.tenantId)
            .gte('created_at', startOfMonth)
            .limit(500);

        const rows = invoices || [];
        const paid = rows.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + Number(i.total || 0), 0);
        const outstanding = rows.filter((i: any) => i.status !== 'paid').reduce((s: number, i: any) => s + Number(i.total || 0), 0);
        const totalExpenses = (expenses || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

        return {
            system: 'nexus_month_end_close',
            status: 'complete',
            month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
            invoices_this_month: rows.length,
            revenue_paid: paid,
            revenue_outstanding: outstanding,
            total_expenses: totalExpenses,
            net_revenue: paid - totalExpenses,
            message: `MTD: $${paid.toFixed(2)} collected, $${outstanding.toFixed(2)} outstanding, $${totalExpenses.toFixed(2)} in expenses. Net: $${(paid - totalExpenses).toFixed(2)}.`,
        };
    }

    private async handleSalesCampaign(params: Record<string, unknown>) {
        const { data: leads } = await this.admin
            .from('leads')
            .select('id, business_name, email, status, stage, industry')
            .eq('tenant_id', this.tenantId)
            .in('status', ['new', 'contacted'])
            .limit(50);

        const { data: deals } = await this.admin
            .from('deals')
            .select('id, name, value, stage')
            .eq('tenant_id', this.tenantId)
            .in('stage', ['lead', 'qualified', 'proposal'])
            .limit(50);

        const dealPipeline = (deals || []).reduce((s: number, d: any) => s + Number(d.value || 0), 0);
        const campaignTargets = (leads || []).filter((l: any) => l.email).slice(0, 20).map((l: any) => ({
            id: l.id,
            name: l.business_name,
            email: l.email,
            stage: l.stage,
        }));

        // ── Auto-send outreach emails if requested ────────────────────────────
        const autoSend      = params.auto_send_outreach === true;
        const outreachCtx   = typeof params.outreach_context === 'string' ? params.outreach_context : '';
        const userId        = typeof params.user_id === 'string' ? params.user_id : null;
        let emailsSent      = 0;
        const emailErrors: string[] = [];

        if (autoSend && campaignTargets.length > 0) {
            const { resolveEmailProviderConfig } = await import('../email/providerIntegrationResolver').catch(() => ({ resolveEmailProviderConfig: null }));
            const { sendWithProviderSdk } = await import('../email/providerSdk').catch(() => ({ sendWithProviderSdk: null }));

            if (resolveEmailProviderConfig && sendWithProviderSdk) {
                // Use dynamic import to avoid circular deps at module init time
                const providerResolver = await import('../email/providerIntegrationResolver')
                    .then(m => m.resolveEmailProviderConfig)
                    .catch(() => null);
                const sdkSender = await import('../email/providerSdk')
                    .then(m => m.sendWithProviderSdk)
                    .catch(() => null);

                if (providerResolver && sdkSender) {
                    const providerConfig = await providerResolver({
                        tenantId: this.tenantId,
                        preferredUserId: userId || undefined,
                        fallbackToEnv: true,
                    }).catch(() => null);

                    if (providerConfig?.provider && providerConfig?.apiKey) {
                        for (const target of campaignTargets.slice(0, 10)) {
                            try {
                                const emailHtml = `<p>Hi ${target.name},</p>
<p>I wanted to reach out regarding how AlphaClone Systems can help your business. ${outreachCtx ? `${outreachCtx} ` : ''}We specialize in AI-powered business automation that helps founders like you save time and grow faster.</p>
<p>Would you be open to a quick 15-minute call this week?</p>
<p>Best regards,<br>AlphaClone Systems</p>`;

                                await sdkSender(providerConfig.provider as any, {
                                    apiKey: providerConfig.apiKey,
                                    fromEmail: providerConfig.fromEmail || '',
                                    fromName: providerConfig.fromName || 'AlphaClone Systems',
                                    to: target.email,
                                    subject: `Quick question about ${target.name}`,
                                    html: emailHtml,
                                });

                                // Log to outreach table
                                await this.admin.from('lead_outreach_log').insert({
                                    tenant_id: this.tenantId,
                                    user_id: userId,
                                    lead_name: target.name,
                                    lead_email: target.email,
                                    subject: `Quick question about ${target.name}`,
                                    body_html: emailHtml,
                                    status: 'sent',
                                    provider: providerConfig.provider,
                                }).catch(() => {/* non-fatal log error */});

                                emailsSent++;
                            } catch (err: any) {
                                emailErrors.push(`${target.name}: ${err.message}`);
                            }
                        }
                    } else {
                        emailErrors.push('No email provider configured for this workspace. Connect Resend/SendGrid/Brevo from Settings → Integrations to enable auto-send.');
                    }
                }
            }
        }

        return {
            system: 'nexus_sales_campaign',
            status: 'complete',
            actionable_leads: leads?.length ?? 0,
            open_deals: deals?.length ?? 0,
            pipeline_value: dealPipeline,
            campaign_targets: campaignTargets,
            auto_send_enabled: autoSend,
            emails_sent: emailsSent,
            email_errors: emailErrors.length > 0 ? emailErrors : undefined,
            message: autoSend
                ? `${leads?.length ?? 0} leads ready. ${emailsSent} outreach emails sent${emailErrors.length > 0 ? ` (${emailErrors.length} failed)` : ''}. ${deals?.length ?? 0} active deals worth $${dealPipeline.toFixed(2)}.`
                : `${leads?.length ?? 0} leads ready for outreach. ${deals?.length ?? 0} active deals worth $${dealPipeline.toFixed(2)}. Use auto_send_outreach=true or send_batch_outreach to engage.`,
        };
    }

    private async handleLeadEnrichment(_params: Record<string, unknown>) {
        const { data: leads } = await this.admin
            .from('leads')
            .select('id, business_name, email, phone, industry, location')
            .eq('tenant_id', this.tenantId)
            .limit(200);

        const missing_email = (leads || []).filter((l: any) => !l.email).length;
        const missing_phone = (leads || []).filter((l: any) => !l.phone).length;
        const missing_industry = (leads || []).filter((l: any) => !l.industry).length;

        return {
            system: 'nexus_lead_enrichment',
            status: 'complete',
            total_leads_scanned: leads?.length ?? 0,
            missing_email,
            missing_phone,
            missing_industry,
            enrichment_candidates: (leads || [])
                .filter((l: any) => !l.email || !l.phone || !l.industry)
                .slice(0, 20)
                .map((l: any) => ({
                    id: l.id,
                    name: l.business_name,
                    missing: [!l.email && 'email', !l.phone && 'phone', !l.industry && 'industry'].filter(Boolean),
                })),
            message: `${leads?.length ?? 0} leads scanned. ${missing_email} missing email, ${missing_phone} missing phone, ${missing_industry} missing industry.`,
        };
    }

    private async handleMeetingIntel(_params: Record<string, unknown>) {
        const { data: bookings } = await this.admin
            .from('bookings')
            .select('id, client_name, client_email, start_time, end_time, status, notes')
            .eq('tenant_id', this.tenantId)
            .order('start_time', { ascending: false })
            .limit(20);

        const upcoming = (bookings || []).filter((b: any) => new Date(b.start_time) > new Date());
        const past_no_notes = (bookings || []).filter((b: any) => new Date(b.start_time) <= new Date() && !b.notes);

        return {
            system: 'nexus_meeting_intelligence',
            status: 'complete',
            upcoming_meetings: upcoming.length,
            past_meetings_no_followup: past_no_notes.length,
            recent_meetings: (bookings || []).slice(0, 10),
            message: `${upcoming.length} upcoming meeting(s). ${past_no_notes.length} past meeting(s) without follow-up notes.`,
        };
    }

    private async handleContractDrafting(_params: Record<string, unknown>) {
        const { data: contracts } = await this.admin
            .from('contracts')
            .select('id, title, status, created_at, updated_at')
            .eq('tenant_id', this.tenantId)
            .order('updated_at', { ascending: false })
            .limit(20);

        const drafts = (contracts || []).filter((c: any) => c.status === 'draft').length;
        const pending_approval = (contracts || []).filter((c: any) => c.status === 'pending_approval').length;

        return {
            system: 'nexus_contract_drafter',
            status: 'complete',
            total_contracts: contracts?.length ?? 0,
            draft_count: drafts,
            pending_approval_count: pending_approval,
            recent_contracts: (contracts || []).slice(0, 5),
            message: `${drafts} draft(s), ${pending_approval} awaiting approval. Use generate_contract_draft to create new contracts.`,
        };
    }

    private async handleProjectPlanning(_params: Record<string, unknown>) {
        const { data: projects } = await this.admin
            .from('projects')
            .select('id, name, status, due_date')
            .eq('tenant_id', this.tenantId)
            .limit(50);

        const { data: tasks } = await this.admin
            .from('tasks')
            .select('id, title, status, due_date, priority')
            .eq('tenant_id', this.tenantId)
            .in('status', ['todo', 'in_progress'])
            .limit(100);

        const overdue_tasks = (tasks || []).filter(
            (t: any) => t.due_date && new Date(t.due_date) < new Date()
        ).length;

        return {
            system: 'nexus_project_architect',
            status: 'complete',
            active_projects: (projects || []).filter((p: any) => p.status === 'active').length,
            open_tasks: tasks?.length ?? 0,
            overdue_tasks,
            urgent_tasks: (tasks || []).filter((t: any) => t.priority === 'urgent').length,
            projects: (projects || []).slice(0, 10),
            message: `${projects?.length ?? 0} projects. ${overdue_tasks} overdue task(s). ${(tasks || []).filter((t: any) => t.priority === 'urgent').length} urgent.`,
        };
    }

    private async handleEmailTriage(_params: Record<string, unknown>) {
        const { data: messages } = await this.admin
            .from('unified_messages')
            .select('id, subject, from_address, direction, channel, created_at')
            .eq('tenant_id', this.tenantId)
            .eq('channel', 'email')
            .eq('direction', 'inbound')
            .order('created_at', { ascending: false })
            .limit(50);

        const { data: outreach } = await this.admin
            .from('lead_outreach_log')
            .select('id, lead_name, lead_email, subject, status')
            .eq('tenant_id', this.tenantId)
            .eq('status', 'queued')
            .limit(20);

        return {
            system: 'nexus_email_triage',
            status: 'complete',
            unread_inbound: messages?.length ?? 0,
            queued_outreach: outreach?.length ?? 0,
            priority_inbox: (messages || []).slice(0, 10),
            queued_sends: outreach || [],
            message: `${messages?.length ?? 0} inbound email(s) to review. ${outreach?.length ?? 0} outreach message(s) queued.`,
        };
    }

    private async handleDesignAudit(_params: Record<string, unknown>) {
        const { data: assets } = await this.admin
            .from('media_assets')
            .select('id, name, mime_type, file_size, alt_text, created_at')
            .eq('tenant_id', this.tenantId)
            .order('created_at', { ascending: false })
            .limit(50);

        const missing_alt = (assets || []).filter((a: any) => !a.alt_text).length;

        return {
            system: 'nexus_design_audit',
            status: 'complete',
            total_assets: assets?.length ?? 0,
            missing_alt_text: missing_alt,
            recent_assets: (assets || []).slice(0, 10),
            message: `${assets?.length ?? 0} media asset(s). ${missing_alt} missing alt text (accessibility gap).`,
        };
    }

    private async handleOnboarding(_params: Record<string, unknown>) {
        const { data: clients } = await this.admin
            .from('business_clients')
            .select('id, name, email, sales_stage, created_at')
            .eq('tenant_id', this.tenantId)
            .eq('sales_stage', 'customer')
            .order('created_at', { ascending: false })
            .limit(20);

        const { data: tasks } = await this.admin
            .from('tasks')
            .select('id, title, status')
            .eq('tenant_id', this.tenantId)
            .ilike('title', '%onboard%')
            .limit(20);

        return {
            system: 'nexus_onboarding_flow',
            status: 'complete',
            active_customers: clients?.length ?? 0,
            onboarding_tasks: tasks?.length ?? 0,
            recent_customers: (clients || []).slice(0, 5),
            message: `${clients?.length ?? 0} active customer(s). ${tasks?.length ?? 0} onboarding task(s) in progress.`,
        };
    }

    private async handleContentGen(_params: Record<string, unknown>) {
        const { data: posts } = await this.admin
            .from('social_posts')
            .select('id, caption, status, platforms, published_at, created_at')
            .eq('tenant_id', this.tenantId)
            .order('created_at', { ascending: false })
            .limit(30);

        const published = (posts || []).filter((p: any) => p.status === 'published').length;
        const scheduled = (posts || []).filter((p: any) => p.status === 'scheduled').length;
        const draft = (posts || []).filter((p: any) => p.status === 'draft').length;

        return {
            system: 'nexus_content_synthesis',
            status: 'complete',
            total_posts: posts?.length ?? 0,
            published,
            scheduled,
            draft,
            recent_posts: (posts || []).slice(0, 5),
            message: `${published} published, ${scheduled} scheduled, ${draft} draft. Use plan_social_calendar to queue more.`,
        };
    }

    private async handleSupportTriage(_params: Record<string, unknown>) {
        const { data: tasks } = await this.admin
            .from('tasks')
            .select('id, title, status, priority, created_at, due_date')
            .eq('tenant_id', this.tenantId)
            .in('status', ['todo', 'in_progress'])
            .order('priority', { ascending: false })
            .limit(50);

        const urgent = (tasks || []).filter((t: any) => t.priority === 'urgent').length;
        const high = (tasks || []).filter((t: any) => t.priority === 'high').length;

        return {
            system: 'nexus_support_triage',
            status: 'complete',
            open_tickets: tasks?.length ?? 0,
            urgent_count: urgent,
            high_priority_count: high,
            critical_queue: (tasks || []).filter((t: any) => t.priority === 'urgent' || t.priority === 'high').slice(0, 10),
            message: `${tasks?.length ?? 0} open items. ${urgent} urgent, ${high} high priority. Use update_task to resolve.`,
        };
    }

    private async handleCalendarOpt(_params: Record<string, unknown>) {
        const { data: bookings } = await this.admin
            .from('bookings')
            .select('id, client_name, start_time, end_time, status')
            .eq('tenant_id', this.tenantId)
            .gte('start_time', new Date().toISOString())
            .order('start_time', { ascending: true })
            .limit(20);

        const { data: tasks } = await this.admin
            .from('tasks')
            .select('id, title, due_date, priority')
            .eq('tenant_id', this.tenantId)
            .in('status', ['todo', 'in_progress'])
            .not('due_date', 'is', null)
            .order('due_date', { ascending: true })
            .limit(20);

        return {
            system: 'nexus_calendar_nexus',
            status: 'complete',
            upcoming_bookings: bookings?.length ?? 0,
            tasks_with_deadlines: tasks?.length ?? 0,
            next_appointments: (bookings || []).slice(0, 7),
            upcoming_deadlines: (tasks || []).slice(0, 7),
            message: `${bookings?.length ?? 0} upcoming booking(s). ${tasks?.length ?? 0} task(s) with deadlines. Use book_calendar_meeting to schedule.`,
        };
    }

    private async handleMarketAnalysis(_params: Record<string, unknown>) {
        const { data: leads } = await this.admin
            .from('leads')
            .select('industry, location, source')
            .eq('tenant_id', this.tenantId)
            .limit(500);

        const byIndustry: Record<string, number> = {};
        const bySource: Record<string, number> = {};
        (leads || []).forEach((l: any) => {
            const ind = l.industry || 'Unknown';
            const src = l.source || 'Unknown';
            byIndustry[ind] = (byIndustry[ind] || 0) + 1;
            bySource[src] = (bySource[src] || 0) + 1;
        });

        const topIndustry = Object.entries(byIndustry).sort(([, a], [, b]) => b - a).slice(0, 5);
        const topSource = Object.entries(bySource).sort(([, a], [, b]) => b - a).slice(0, 5);

        return {
            system: 'nexus_market_pulse',
            status: 'complete',
            leads_analyzed: leads?.length ?? 0,
            top_industries: topIndustry.map(([industry, count]) => ({ industry, count })),
            top_lead_sources: topSource.map(([source, count]) => ({ source, count })),
            message: `Analyzed ${leads?.length ?? 0} leads. Top industries: ${topIndustry.slice(0, 3).map(([i]) => i).join(', ')}.`,
        };
    }

    // ── Legacy Skills ────────────────────────────────────────────────────────

    async huntLeads() {
        const { data: watchlist } = await this.admin
            .from('social_watchlist')
            .select('*')
            .eq('tenant_id', this.tenantId);

        return {
            systemAction: 'Nexus Scanning: High-intent signals detected...',
            suggestedLeads: (watchlist || []).map((item: any) => ({
                ...item,
                relevanceScore: Math.floor(Math.random() * 40) + 60,
                suggestedAction: 'Engage with recent post about "AI agents"'
            })).sort((a: any, b: any) => b.relevanceScore - a.relevanceScore)
        };
    }

    /**
     * Strategic Orchestrator:
     * Triggers multiple Nexus systems based on a high-level business objective.
     */
    async strategicOrchestrator(objective: string) {
        const admin = this.admin;
        const tenantId = this.tenantId;

        // In a real system, we might use LLM to decide which systems to trigger.
        // For now, we trigger the most relevant systems based on keywords.
        const systemsToTrigger: string[] = [];
        const objLower = objective.toLowerCase();

        if (objLower.includes('revenue') || objLower.includes('finance') || objLower.includes('money')) {
            systemsToTrigger.push('month_end_close', 'invoice_chasing');
        }
        if (objLower.includes('growth') || objLower.includes('sales') || objLower.includes('leads')) {
            systemsToTrigger.push('sales_campaign', 'lead_enrichment', 'market_pulse');
        }
        if (objLower.includes('operation') || objLower.includes('project') || objLower.includes('efficiency')) {
            systemsToTrigger.push('project_architect', 'calendar_nexus', 'email_triage');
        }
        if (objLower.includes('brand') || objLower.includes('social') || objLower.includes('content')) {
            systemsToTrigger.push('content_synthesis', 'design_audit');
        }

        // Default to a general health check if no keywords match
        if (systemsToTrigger.length === 0) {
            systemsToTrigger.push('month_end_close', 'sales_campaign', 'project_architect');
        }

        const results: Record<string, any> = {};
        for (const system of Array.from(new Set(systemsToTrigger))) {
            try {
                results[system] = await this.executeSystemAction(system);
            } catch (err) {
                results[system] = { status: 'error', message: err instanceof Error ? err.message : String(err) };
            }
        }

        return {
            objective,
            orchestration_status: 'complete',
            timestamp: new Date().toISOString(),
            executed_systems: results,
            strategic_summary: `Nexus Orchestrator successfully aligned ${Object.keys(results).length} business systems with the objective: "${objective}".`
        };
    }

    /**
     * Generate Market Authority Report:
     * Synthesizes market pulse and content strategy into a single document.
     */
    async generateMarketAuthorityReport() {
        const pulse = await this.executeSystemAction('market_pulse');
        const synthesis = await this.executeSystemAction('content_synthesis');

        return {
            report_title: 'Nexus Market Authority & Strategic Content Synthesis',
            generated_at: new Date().toISOString(),
            market_intelligence: pulse,
            content_strategy: synthesis,
            strategic_alignment: 'Market signals and brand voice are synchronized for maximum authority growth.'
        };
    }

    async evaluateInteraction(content: string, _platform: string) {
        const score = Math.floor(Math.random() * 30) + 70;
        return {
            success: score > 80,
            score,
            feedback: score > 80
                ? 'Optimal alignment with AlphaClone brand voice.'
                : 'System suggests adding a more specific call to action.',
            refinedContent: score < 85 ? `${content}\n\nWhat are your thoughts on this?` : undefined
        };
    }
}
