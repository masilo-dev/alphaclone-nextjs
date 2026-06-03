import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import Stripe from 'stripe';
import { socialPostGenerationService } from '@/services/socialPostGenerationService';

type RunnerActionStatus = 'success' | 'failed' | 'skipped';

type RunnerSummary = {
  tenantId: string;
  actions: Array<{ key: string; status: RunnerActionStatus; details: string }>;
};

type TenantRunnerRules = {
  enabled: boolean;
  auto_send_enabled: boolean;
  auto_send_confidence_threshold: number;
  high_risk_approval_required: boolean;
  stale_deal_days: number;
  social_inactivity_days: number;
  lead_action_mode?: string;
  email_provider?: string;
};


const BUYING_SIGNAL_PATTERNS = [
  /\bprice\b/i,
  /\bcost\b/i,
  /\bquote\b/i,
  /\bproposal\b/i,
  /\bcontract\b/i,
  /\bstart\b/i,
  /\bwhen can we\b/i,
  /\binterested\b/i,
  /\bbook\b/i,
  /\bdemo\b/i,
];

function hasBuyingSignal(text: string): boolean {
  return BUYING_SIGNAL_PATTERNS.some((pattern) => pattern.test(text));
}

function toIsoDate(date: Date): string {
  return date.toISOString().split('T')[0] || '';
}

async function processAutopilotApprovals(
  admin: any,
  tenantId: string,
  rules: TenantRunnerRules,
  recordAction: (key: string, status: RunnerActionStatus, details: string, payload?: Record<string, unknown>) => Promise<void>
) {
  if (!rules.auto_send_enabled) return;
  try {
    const { data: pendingApprovals } = await admin
      .from('autonomous_runner_approvals')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending');

    if (pendingApprovals && pendingApprovals.length > 0) {
      // 1. Fetch or create Sovereign AI Treasury bank account
      let treasuryAccount: any = null;
      try {
        const { data: existing } = await admin
          .from('bank_accounts')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('name', 'Sovereign AI Treasury')
          .maybeSingle();

        if (existing) {
          treasuryAccount = existing;
        } else {
          const { data: created, error: createErr } = await admin
            .from('bank_accounts')
            .insert({
              tenant_id: tenantId,
              name: 'Sovereign AI Treasury',
              account_number_last4: '0000',
              bank_name: 'AlphaClone Virtual Bank',
              account_type: 'checking',
              currency: 'USD',
              opening_balance: 1000.00,
              current_balance: 1000.00,
              is_active: true,
              metadata: { system_managed: true }
            })
            .select('*')
            .maybeSingle();
          if (!createErr && created) {
            treasuryAccount = created;
          }
        }
      } catch (err) {
        console.warn('[Autopilot] Treasury account DB access failed, operating in virtual mode:', err);
      }

      let autoApprovedCount = 0;
      for (const app of pendingApprovals) {
        const confidence = app.confidence_score ?? 0;
        const threshold = rules.auto_send_confidence_threshold ?? 85;
        if (confidence >= threshold) {
          // 2. Validate Sovereign AI Treasury balance
          const actionCost = 0.05; // $0.05 per AI action
          if (treasuryAccount && (treasuryAccount.current_balance ?? 0) < actionCost) {
            console.warn(`[Autopilot] Insufficient Sovereign AI Treasury funds for tenant ${tenantId}. Balance: ${treasuryAccount.current_balance}`);
            await recordAction('autopilot_treasury_warning', 'skipped', `Sovereign AI Treasury balance too low to auto-approve action. Required: $${actionCost}, Balance: $${treasuryAccount.current_balance}`);
            continue;
          }

          try {
            if (app.action_key === 'auto_reply_buying_signal') {
              const payload = app.payload || {};
              const replyText = `Thank you for your message. We can move this forward today. I have prepared the next step and can send pricing and implementation options immediately.`;
              await admin.from('messages').insert({
                tenant_id: tenantId,
                sender_id: null,
                sender_name: 'Alpha AI Operator',
                sender_role: 'ai',
                recipient_id: payload.senderId,
                text: replyText,
                priority: 'high',
                reply_to: payload.messageId,
              });
            } else if (app.action_key === 'custom_playbook_outreach') {
              const payload = app.payload || {};
              await admin.from('messages').insert({
                tenant_id: tenantId,
                sender_id: null,
                sender_name: 'Alpha SDR Agent',
                sender_role: 'ai',
                text: payload.email_body || '',
                priority: 'normal',
              });
            }

            // Update approvals table status
            await admin
              .from('autonomous_runner_approvals')
              .update({ status: 'approved', updated_at: new Date().toISOString() })
              .eq('id', app.id);

            // Deduct treasury balance and log transaction if active
            if (treasuryAccount) {
              const newBalance = Math.max(0, (treasuryAccount.current_balance ?? 0) - actionCost);
              await admin
                .from('bank_accounts')
                .update({ current_balance: newBalance })
                .eq('id', treasuryAccount.id);
              treasuryAccount.current_balance = newBalance;

              try {
                await admin.from('accounting_transactions').insert({
                  tenant_id: tenantId,
                  type: 'expense',
                  reference_id: app.id,
                  amount: actionCost,
                  currency: 'USD',
                  status: 'completed',
                  metadata: { description: 'Sovereign AI Agent execution cost', action_key: app.action_key },
                  created_at: new Date().toISOString()
                });
              } catch (txErr) {
                console.warn('[Autopilot] Failed to record transaction log:', txErr);
              }
            }
            
            autoApprovedCount++;
          } catch (e) {
            console.error(`[Autopilot] Failed to auto-approve action ${app.id}:`, e);
          }
        }
      }
      if (autoApprovedCount > 0) {
        await recordAction('autopilot_auto_approvals', 'success', `Sovereign Autopilot automatically approved and executed ${autoApprovedCount} pending actions.`);
      }
    }
  } catch (error) {
    console.error('[Autopilot] Error processing autopilot approvals:', error);
  }
}

export const autonomousRunnerService = {
  async runOnce(): Promise<{ success: boolean; runs: RunnerSummary[]; error?: string }> {
    const admin = createSupabaseAdminClient();
    const runs: RunnerSummary[] = [];
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: '2025-12-15.clover' }) : null;

    try {
      const { data: tenants, error: tenantError } = await admin.from('tenants').select('id').limit(1000);
      if (tenantError) throw tenantError;

      for (const tenant of tenants || []) {
        const tenantId = String(tenant.id);
        const summary: RunnerSummary = { tenantId, actions: [] };
        const runStartedAt = new Date().toISOString();
        const defaultRules: TenantRunnerRules = {
          enabled: true,
          auto_send_enabled: false,
          auto_send_confidence_threshold: 85,
          high_risk_approval_required: true,
          stale_deal_days: 7,
          social_inactivity_days: 3,
          lead_action_mode: 'draft_and_task',
          email_provider: 'system_default',
        };
        const { data: rulesRow } = await admin
          .from('autonomous_runner_rules')
          .select('enabled, auto_send_enabled, auto_send_confidence_threshold, high_risk_approval_required, stale_deal_days, social_inactivity_days, lead_action_mode, email_provider')
          .eq('tenant_id', tenantId)
          .maybeSingle();
        const rules = { ...defaultRules, ...(rulesRow || {}) } as TenantRunnerRules;
        if (!rules.enabled) {
          runs.push({
            tenantId,
            actions: [{ key: 'runner_disabled', status: 'skipped', details: 'Autonomous runner is disabled by tenant rules' }],
          });
          continue;
        }

        const { data: runRow } = await admin
          .from('autonomous_runner_runs')
          .insert({
            tenant_id: tenantId,
            status: 'running',
            started_at: runStartedAt,
            trigger_snapshot: { source: 'cron' },
          })
          .select('id')
          .single();

        const runId = runRow?.id as string | undefined;

        const recordAction = async (key: string, status: RunnerActionStatus, details: string, payload?: Record<string, unknown>) => {
          summary.actions.push({ key, status, details });
          if (!runId) return;
          await admin.from('autonomous_runner_actions').insert({
            run_id: runId,
            tenant_id: tenantId,
            action_key: key,
            status,
            details,
            payload: payload || {},
          });
        };
        const createApproval = async (
          actionKey: string,
          riskLevel: 'low' | 'medium' | 'high',
          confidenceScore: number,
          reason: string,
          payload?: Record<string, unknown>
        ) => {
          if (!rules.high_risk_approval_required && riskLevel !== 'high') return;
          await admin.from('autonomous_runner_approvals').insert({
            tenant_id: tenantId,
            run_id: runId || null,
            action_key: actionKey,
            risk_level: riskLevel,
            confidence_score: Math.max(0, Math.min(100, Math.round(confidenceScore))),
            reason,
            payload: payload || {},
            status: 'pending',
          });
        };

        // 1) Unread buying-signal inbox -> draft reply + task
        try {
          const { data: recentMessages } = await admin
            .from('messages')
            .select('id, text, sender_id, tenant_id, created_at')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false })
            .limit(50);

          const buyingSignals = (recentMessages || []).filter((m: any) => hasBuyingSignal(String(m.text || '')));
          const actionMode = rules.lead_action_mode || 'draft_and_task';
          const shouldDraft = actionMode === 'draft_and_task' || actionMode === 'draft_only';
          const shouldCreateTask = actionMode === 'draft_and_task' || actionMode === 'task_only';

          let createdTasks = 0;
          let autoReplies = 0;
          for (const msg of buyingSignals.slice(0, 5)) {
            const text = String(msg.text || '');
            const confidence = Math.min(98, 55 + (BUYING_SIGNAL_PATTERNS.filter((p) => p.test(text)).length * 9));
            const riskLevel: 'low' | 'medium' | 'high' = confidence >= 90 ? 'high' : confidence >= 75 ? 'medium' : 'low';
            const canAutoSend = rules.auto_send_enabled && confidence >= rules.auto_send_confidence_threshold && riskLevel !== 'high';
            
            if (shouldDraft) {
              if (canAutoSend && msg.sender_id) {
                const replyText = `Thank you for your message. We can move this forward today. I have prepared the next step and can send pricing and implementation options immediately.`;
                const { error: replyError } = await admin.from('messages').insert({
                  tenant_id: tenantId,
                  sender_id: null,
                  sender_name: 'Alpha AI Operator',
                  sender_role: 'ai',
                  recipient_id: msg.sender_id,
                  text: replyText,
                  priority: 'high',
                  reply_to: msg.id,
                });
                if (!replyError) {
                  autoReplies += 1;
                  await recordAction('auto_reply_buying_signal', 'success', `Auto-replied to message ${msg.id}`, { confidence, riskLevel });
                } else {
                  await recordAction('auto_reply_buying_signal', 'failed', `Failed reply on message ${msg.id}: ${replyError.message}`);
                }
              } else {
                // Log refusal reason when auto send fails confidence threshold or risk level requires approval
                const refusalReason = !rules.auto_send_enabled 
                  ? 'Sovereign Autopilot not engaged'
                  : confidence < rules.auto_send_confidence_threshold
                    ? `Confidence score ${confidence}% below threshold of ${rules.auto_send_confidence_threshold}%`
                    : `High risk level (${riskLevel}) requires manual approval`;

                await createApproval(
                  'auto_reply_buying_signal',
                  riskLevel,
                  confidence,
                  refusalReason,
                  { messageId: msg.id, senderId: msg.sender_id || null, confidence, is_refusal: true, refusal_reason: refusalReason }
                );

                await recordAction('auto_reply_buying_signal', 'skipped', `Direct auto-reply skipped: ${refusalReason}. Created approval request.`, {
                  is_refusal: true,
                  refusal_reason: refusalReason,
                  confidence
                });
              }
            } else {
              await recordAction('auto_reply_buying_signal', 'skipped', `Message reply skipped (Lead Action Mode set to '${actionMode}')`, {
                is_refusal: true,
                refusal_reason: `Lead Action Mode set to '${actionMode}'`
              });
            }

            if (shouldCreateTask) {
              const taskTitle = `Follow up on buying-signal message`;
              const taskDescription = `[AI LOG] ${new Date().toISOString()} Buying-signal detected in message ${msg.id}. Draft response and advance lead context.`;
              const { error: taskError } = await admin.from('tasks').insert({
                tenant_id: tenantId,
                title: taskTitle,
                description: taskDescription,
                priority: 'high',
                status: 'todo',
                due_date: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
              });
              if (!taskError) createdTasks += 1;
            } else {
              await recordAction('create_task_buying_signal', 'skipped', `Task creation skipped (Lead Action Mode set to '${actionMode}')`, {
                is_refusal: true,
                refusal_reason: `Lead Action Mode set to '${actionMode}'`
              });
            }
          }
          await recordAction('unread_buying_signal_inbox', 'success', `Detected ${buyingSignals.length} signals, created ${createdTasks} tasks, sent ${autoReplies} auto-replies`, {
            detected: buyingSignals.length,
            createdTasks,
            autoReplies,
          });
        } catch (error) {
          await recordAction('unread_buying_signal_inbox', 'failed', error instanceof Error ? error.message : 'Unknown error');
        }

        // 2) Stale deals (7+ days) -> score hint + follow-up task
        try {
          const staleDate = new Date(Date.now() - rules.stale_deal_days * 24 * 60 * 60 * 1000).toISOString();
          const { data: staleDeals } = await admin
            .from('deals')
            .select('id, name, stage, value, updated_at')
            .eq('tenant_id', tenantId)
            .lt('updated_at', staleDate)
            .in('stage', ['lead', 'qualified', 'proposal', 'negotiation'])
            .limit(30);

          let createdTasks = 0;
          for (const deal of staleDeals || []) {
            const { error: taskError } = await admin.from('tasks').insert({
              tenant_id: tenantId,
              title: `Advance stale deal: ${deal.name || deal.id}`,
              description: `[AI LOG] ${new Date().toISOString()} Deal is stale for 7+ days. Re-score and execute follow-up outreach.`,
              priority: 'high',
              status: 'todo',
              due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            });
            if (!taskError) createdTasks += 1;
          }
          await recordAction('stale_deals_7_days', 'success', `Found ${(staleDeals || []).length} stale deals (>${rules.stale_deal_days} days), created ${createdTasks} tasks`, {
            staleDeals: (staleDeals || []).length,
            createdTasks,
          });
        } catch (error) {
          await recordAction('stale_deals_7_days', 'failed', error instanceof Error ? error.message : 'Unknown error');
        }

        // 3) Overdue invoices -> escalation loop
        try {
          const todayIso = toIsoDate(new Date());
          const { data: overdueInvoices } = await admin
            .from('business_invoices')
            .select('id, tenant_id, client_id, invoice_number, due_date, status, reminder_count')
            .eq('tenant_id', tenantId)
            .lt('due_date', todayIso)
            .in('status', ['sent', 'overdue'])
            .limit(50);

          let escalations = 0;
          for (const invoice of overdueInvoices || []) {
            const reminderCount = Number(invoice.reminder_count || 0);
            const escalationLevel = reminderCount >= 2 ? 'final_notice' : 'standard_overdue_followup';
            const { error: reminderError } = await admin.from('invoice_reminders').insert({
              tenant_id: tenantId,
              invoice_id: invoice.id,
              reminder_type: escalationLevel,
              sent_to: null,
              status: 'pending',
              metadata: {
                invoiceNumber: invoice.invoice_number,
                generatedBy: 'autonomous_runner',
              },
            });
            if (!reminderError) escalations += 1;
          }
          await recordAction('overdue_invoices_escalation', 'success', `Found ${(overdueInvoices || []).length} overdue invoices, queued ${escalations} escalations`, {
            overdueInvoices: (overdueInvoices || []).length,
            escalations,
          });
        } catch (error) {
          await recordAction('overdue_invoices_escalation', 'failed', error instanceof Error ? error.message : 'Unknown error');
        }

        // 4) No social posts in 3 days -> create proactive drafts
        try {
          const threeDaysAgo = new Date(Date.now() - rules.social_inactivity_days * 24 * 60 * 60 * 1000).toISOString();
          const { data: recentPosts } = await admin
            .from('social_posts')
            .select('id, created_at')
            .eq('tenant_id', tenantId)
            .gte('created_at', threeDaysAgo)
            .limit(1);

          if ((recentPosts || []).length === 0) {
            const now = new Date();
            const tomorrowMorning = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            tomorrowMorning.setHours(9, 0, 0, 0);
            const tomorrowAfternoon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            tomorrowAfternoon.setHours(13, 0, 0, 0);

            const linkedInGenerated = await socialPostGenerationService.generateMultiPass({
              platform: 'linkedin',
              pillar: 'tactical_how_to',
              topic: 'sales follow-up automation',
              monthlyGoal: 'Lead generation and authority growth',
              includeCta: true,
            });
            const facebookGenerated = await socialPostGenerationService.generateMultiPass({
              platform: 'facebook',
              pillar: 'behind_the_scenes',
              topic: 'sales follow-up automation',
              monthlyGoal: 'Community engagement and pipeline trust',
              includeCta: true,
            });
            const linkedInCaption = linkedInGenerated.content;
            const facebookCaption = facebookGenerated.content;

            await admin.from('social_posts').insert([
              {
                tenant_id: tenantId,
                caption: linkedInCaption,
                platforms: ['linkedin'],
                status: 'scheduled',
                scheduled_at: tomorrowMorning.toISOString(),
                metadata: {
                  generatedBy: 'autonomous_runner',
                  pillar: 'tactical_how_to',
                  generation: {
                    strategistNotes: linkedInGenerated.strategistNotes,
                    reviewerNotes: linkedInGenerated.reviewerNotes,
                    confidenceScore: linkedInGenerated.confidenceScore,
                  },
                },
              },
              {
                tenant_id: tenantId,
                caption: facebookCaption,
                platforms: ['facebook'],
                status: 'scheduled',
                scheduled_at: tomorrowAfternoon.toISOString(),
                metadata: {
                  generatedBy: 'autonomous_runner',
                  pillar: 'behind_the_scenes',
                  generation: {
                    strategistNotes: facebookGenerated.strategistNotes,
                    reviewerNotes: facebookGenerated.reviewerNotes,
                    confidenceScore: facebookGenerated.confidenceScore,
                  },
                },
              },
            ]);
            await recordAction('no_posts_in_3_days', 'success', 'No posts in 3 days, created LinkedIn and Facebook drafts');
          } else {
            await recordAction('no_posts_in_3_days', 'skipped', 'Recent posts exist, no auto-drafts needed');
          }
        } catch (error) {
          await recordAction('no_posts_in_3_days', 'failed', error instanceof Error ? error.message : 'Unknown error');
        }

        // 5) Calendar-aware proactive reminders (next 24h)
        try {
          const start = new Date().toISOString();
          const end = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          const { data: upcomingEvents } = await admin
            .from('calendar_events')
            .select('id, title, user_id, start_time')
            .eq('tenant_id', tenantId)
            .gte('start_time', start)
            .lte('start_time', end)
            .limit(30);

          let prepTasks = 0;
          for (const event of upcomingEvents || []) {
            const { error: taskError } = await admin.from('tasks').insert({
              tenant_id: tenantId,
              assigned_to: event.user_id || null,
              title: `Prepare for upcoming meeting: ${event.title || 'Calendar event'}`,
              description: `[AI LOG] ${new Date().toISOString()} Auto-generated preparation task from calendar event ${event.id}.`,
              priority: 'medium',
              status: 'todo',
              due_date: event.start_time,
            });
            if (!taskError) prepTasks += 1;
          }
          await recordAction('calendar_next_24h_prep', 'success', `Found ${(upcomingEvents || []).length} upcoming events, created ${prepTasks} prep tasks`, {
            upcomingEvents: (upcomingEvents || []).length,
            prepTasks,
          });
        } catch (error) {
          await recordAction('calendar_next_24h_prep', 'failed', error instanceof Error ? error.message : 'Unknown error');
        }

        // 6) Payment loop closure (reconciliation candidates)
        try {
          const { data: candidates } = await admin
            .from('business_invoices')
            .select('id, tenant_id, status, metadata, updated_at')
            .eq('tenant_id', tenantId)
            .in('status', ['sent', 'overdue'])
            .limit(50);

          let reconcileTasks = 0;
          let reconciledPaid = 0;
          for (const invoice of candidates || []) {
            const paymentIntentId = (invoice.metadata as Record<string, unknown> | null)?.stripe_payment_intent;
            if (typeof paymentIntentId === 'string' && paymentIntentId.trim()) {
              if (stripe) {
                try {
                  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
                  if (paymentIntent.status === 'succeeded') {
                    await admin
                      .from('business_invoices')
                      .update({ status: 'paid', updated_at: new Date().toISOString() })
                      .eq('id', invoice.id)
                      .eq('tenant_id', tenantId);
                    reconciledPaid += 1;
                  } else {
                    const { error: taskError } = await admin.from('tasks').insert({
                      tenant_id: tenantId,
                      title: `Reconcile payment status for invoice ${invoice.id}`,
                      description: `[AI LOG] ${new Date().toISOString()} Payment intent status is ${paymentIntent.status}. Continue follow-up.`,
                      priority: 'high',
                      status: 'todo',
                      due_date: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                    });
                    if (!taskError) reconcileTasks += 1;
                  }
                } catch {
                  const { error: taskError } = await admin.from('tasks').insert({
                    tenant_id: tenantId,
                    title: `Reconcile payment status for invoice ${invoice.id}`,
                    description: `[AI LOG] ${new Date().toISOString()} Stripe reconciliation failed, manual verification required.`,
                    priority: 'high',
                    status: 'todo',
                    due_date: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                  });
                  if (!taskError) reconcileTasks += 1;
                }
              } else {
                const { error: taskError } = await admin.from('tasks').insert({
                  tenant_id: tenantId,
                  title: `Reconcile payment status for invoice ${invoice.id}`,
                  description: `[AI LOG] ${new Date().toISOString()} Stripe key unavailable. Manual reconciliation required.`,
                  priority: 'high',
                  status: 'todo',
                  due_date: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                });
                if (!taskError) reconcileTasks += 1;
              }
            }
          }
          await recordAction('payment_loop_reconciliation', 'success', `Auto-reconciled ${reconciledPaid} paid invoices, created ${reconcileTasks} reconciliation tasks`, {
            reconciledPaid,
            reconcileTasks,
          });
        } catch (error) {
          await recordAction('payment_loop_reconciliation', 'failed', error instanceof Error ? error.message : 'Unknown error');
        }

        // Autopilot Auto-Approvals Process
        await processAutopilotApprovals(admin, tenantId, rules, recordAction);

        if (runId) {
          const failedCount = summary.actions.filter((a) => a.status === 'failed').length;
          await admin
            .from('autonomous_runner_runs')
            .update({
              status: failedCount > 0 ? 'partial_success' : 'completed',
              completed_at: new Date().toISOString(),
              summary: { actions: summary.actions },
            })
            .eq('id', runId);
        }

        runs.push(summary);
      }

      return { success: true, runs };
    } catch (error) {
      return { success: false, runs, error: error instanceof Error ? error.message : 'Unknown autonomous runner error' };
    }
  },

  async runForTenant(tenantId: string): Promise<{ success: boolean; run: RunnerSummary | null; error?: string }> {
    const admin = createSupabaseAdminClient();
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: '2025-12-15.clover' }) : null;

    try {
      const summary: RunnerSummary = { tenantId, actions: [] };
      const runStartedAt = new Date().toISOString();
      const defaultRules: TenantRunnerRules = {
        enabled: true,
        auto_send_enabled: false,
        auto_send_confidence_threshold: 85,
        high_risk_approval_required: true,
        stale_deal_days: 7,
        social_inactivity_days: 3,
      };
      const { data: rulesRow } = await admin
        .from('autonomous_runner_rules')
        .select('enabled, auto_send_enabled, auto_send_confidence_threshold, high_risk_approval_required, stale_deal_days, social_inactivity_days')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const rules = { ...defaultRules, ...(rulesRow || {}) } as TenantRunnerRules;
      if (!rules.enabled) {
        return {
          success: true,
          run: {
            tenantId,
            actions: [{ key: 'runner_disabled', status: 'skipped', details: 'Autonomous runner is disabled by tenant rules' }],
          }
        };
      }

      const { data: runRow } = await admin
        .from('autonomous_runner_runs')
        .insert({
          tenant_id: tenantId,
          status: 'running',
          started_at: runStartedAt,
          trigger_snapshot: { source: 'manual' },
        })
        .select('id')
        .single();

      const runId = runRow?.id as string | undefined;

      const recordAction = async (key: string, status: RunnerActionStatus, details: string, payload?: Record<string, unknown>) => {
        summary.actions.push({ key, status, details });
        if (!runId) return;
        await admin.from('autonomous_runner_actions').insert({
          run_id: runId,
          tenant_id: tenantId,
          action_key: key,
          status,
          details,
          payload: payload || {},
        });
      };
      const createApproval = async (
        actionKey: string,
        riskLevel: 'low' | 'medium' | 'high',
        confidenceScore: number,
        reason: string,
        payload?: Record<string, unknown>
      ) => {
        if (!rules.high_risk_approval_required && riskLevel !== 'high') return;
        await admin.from('autonomous_runner_approvals').insert({
          tenant_id: tenantId,
          run_id: runId || null,
          action_key: actionKey,
          risk_level: riskLevel,
          confidence_score: Math.max(0, Math.min(100, Math.round(confidenceScore))),
          reason,
          payload: payload || {},
          status: 'pending',
        });
      };

      // 1) Unread buying-signal inbox -> draft reply + task
      try {
        const { data: recentMessages } = await admin
          .from('messages')
          .select('id, text, sender_id, tenant_id, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(50);

        const buyingSignals = (recentMessages || []).filter((m: any) => hasBuyingSignal(String(m.text || '')));
        let createdTasks = 0;
        let autoReplies = 0;
        for (const msg of buyingSignals.slice(0, 5)) {
          const text = String(msg.text || '');
          const confidence = Math.min(98, 55 + (BUYING_SIGNAL_PATTERNS.filter((p) => p.test(text)).length * 9));
          const riskLevel: 'low' | 'medium' | 'high' = confidence >= 90 ? 'high' : confidence >= 75 ? 'medium' : 'low';
          const canAutoSend = rules.auto_send_enabled && confidence >= rules.auto_send_confidence_threshold && riskLevel !== 'high';
          if (canAutoSend && msg.sender_id) {
            const replyText = `Thank you for your message. We can move this forward today. I have prepared the next step and can send pricing and implementation options immediately.`;
            const { error: replyError } = await admin.from('messages').insert({
              tenant_id: tenantId,
              sender_id: null,
              sender_name: 'Alpha AI Operator',
              sender_role: 'ai',
              recipient_id: msg.sender_id,
              text: replyText,
              priority: 'high',
              reply_to: msg.id,
            });
            if (!replyError) {
              autoReplies += 1;
              await recordAction('auto_reply_buying_signal', 'success', `Auto-replied to message ${msg.id}`, { confidence, riskLevel });
            } else {
              await recordAction('auto_reply_buying_signal', 'failed', `Failed reply on message ${msg.id}: ${replyError.message}`);
            }
          } else {
            await createApproval(
              'auto_reply_buying_signal',
              riskLevel,
              confidence,
              'Auto-send rule not met or high-risk response requires approval',
              { messageId: msg.id, senderId: msg.sender_id || null, confidence }
            );
          }
          const taskTitle = `Follow up on buying-signal message`;
          const taskDescription = `[AI LOG] ${new Date().toISOString()} Buying-signal detected in message ${msg.id}. Draft response and advance lead context.`;
          const { error: taskError } = await admin.from('tasks').insert({
            tenant_id: tenantId,
            title: taskTitle,
            description: taskDescription,
            priority: 'high',
            status: 'todo',
            due_date: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          });
          if (!taskError) createdTasks += 1;
        }
        await recordAction('unread_buying_signal_inbox', 'success', `Detected ${buyingSignals.length} signals, created ${createdTasks} tasks, sent ${autoReplies} auto-replies`, {
          detected: buyingSignals.length,
          createdTasks,
          autoReplies,
        });
      } catch (error) {
        await recordAction('unread_buying_signal_inbox', 'failed', error instanceof Error ? error.message : 'Unknown error');
      }

      // 2) Stale deals (7+ days) -> score hint + follow-up task
      try {
        const staleDate = new Date(Date.now() - rules.stale_deal_days * 24 * 60 * 60 * 1000).toISOString();
        const { data: staleDeals } = await admin
          .from('deals')
          .select('id, name, stage, value, updated_at')
          .eq('tenant_id', tenantId)
          .lt('updated_at', staleDate)
          .in('stage', ['lead', 'qualified', 'proposal', 'negotiation'])
          .limit(30);

        let createdTasks = 0;
        for (const deal of staleDeals || []) {
          const { error: taskError } = await admin.from('tasks').insert({
            tenant_id: tenantId,
            title: `Advance stale deal: ${deal.name || deal.id}`,
            description: `[AI LOG] ${new Date().toISOString()} Deal is stale for 7+ days. Re-score and execute follow-up outreach.`,
            priority: 'high',
            status: 'todo',
            due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          });
          if (!taskError) createdTasks += 1;
        }
        await recordAction('stale_deals_7_days', 'success', `Found ${(staleDeals || []).length} stale deals (>${rules.stale_deal_days} days), created ${createdTasks} tasks`, {
          staleDeals: (staleDeals || []).length,
          createdTasks,
        });
      } catch (error) {
        await recordAction('stale_deals_7_days', 'failed', error instanceof Error ? error.message : 'Unknown error');
      }

      // 3) Overdue invoices -> escalation loop
      try {
        const todayIso = toIsoDate(new Date());
        const { data: overdueInvoices } = await admin
          .from('business_invoices')
          .select('id, tenant_id, client_id, invoice_number, due_date, status, reminder_count')
          .eq('tenant_id', tenantId)
          .lt('due_date', todayIso)
          .in('status', ['sent', 'overdue'])
          .limit(50);

        let escalations = 0;
        for (const invoice of overdueInvoices || []) {
          const reminderCount = Number(invoice.reminder_count || 0);
          const escalationLevel = reminderCount >= 2 ? 'final_notice' : 'standard_overdue_followup';
          const { error: reminderError } = await admin.from('invoice_reminders').insert({
            tenant_id: tenantId,
            invoice_id: invoice.id,
            reminder_type: escalationLevel,
            sent_to: null,
            status: 'pending',
            metadata: {
              invoiceNumber: invoice.invoice_number,
              generatedBy: 'autonomous_runner',
            },
          });
          if (!reminderError) escalations += 1;
        }
        await recordAction('overdue_invoices_escalation', 'success', `Found ${(overdueInvoices || []).length} overdue invoices, queued ${escalations} escalations`, {
          overdueInvoices: (overdueInvoices || []).length,
          escalations,
        });
      } catch (error) {
        await recordAction('overdue_invoices_escalation', 'failed', error instanceof Error ? error.message : 'Unknown error');
      }

      // 4) No social posts in 3 days -> create proactive drafts
      try {
        const threeDaysAgo = new Date(Date.now() - rules.social_inactivity_days * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentPosts } = await admin
          .from('social_posts')
          .select('id, created_at')
          .eq('tenant_id', tenantId)
          .gte('created_at', threeDaysAgo)
          .limit(1);

        if ((recentPosts || []).length === 0) {
          const now = new Date();
          const tomorrowMorning = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          tomorrowMorning.setHours(9, 0, 0, 0);
          const tomorrowAfternoon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          tomorrowAfternoon.setHours(13, 0, 0, 0);

          const linkedInGenerated = await socialPostGenerationService.generateMultiPass({
            platform: 'linkedin',
            pillar: 'tactical_how_to',
            topic: 'sales follow-up automation',
            monthlyGoal: 'Lead generation and authority growth',
            includeCta: true,
          });
          const facebookGenerated = await socialPostGenerationService.generateMultiPass({
            platform: 'facebook',
            pillar: 'behind_the_scenes',
            topic: 'sales follow-up automation',
            monthlyGoal: 'Community engagement and pipeline trust',
            includeCta: true,
          });
          const linkedInCaption = linkedInGenerated.content;
          const facebookCaption = facebookGenerated.content;

          await admin.from('social_posts').insert([
            {
              tenant_id: tenantId,
              caption: linkedInCaption,
              platforms: ['linkedin'],
              status: 'scheduled',
              scheduled_at: tomorrowMorning.toISOString(),
              metadata: {
                generatedBy: 'autonomous_runner',
                pillar: 'tactical_how_to',
                generation: {
                  strategistNotes: linkedInGenerated.strategistNotes,
                  reviewerNotes: linkedInGenerated.reviewerNotes,
                  confidenceScore: linkedInGenerated.confidenceScore,
                },
              },
            },
            {
              tenant_id: tenantId,
              caption: facebookCaption,
              platforms: ['facebook'],
              status: 'scheduled',
              scheduled_at: tomorrowAfternoon.toISOString(),
              metadata: {
                generatedBy: 'autonomous_runner',
                pillar: 'behind_the_scenes',
                generation: {
                  strategistNotes: facebookGenerated.strategistNotes,
                  reviewerNotes: facebookGenerated.reviewerNotes,
                  confidenceScore: facebookGenerated.confidenceScore,
                },
              },
            },
          ]);
          await recordAction('no_posts_in_3_days', 'success', 'No posts in 3 days, created LinkedIn and Facebook drafts');
        } else {
          await recordAction('no_posts_in_3_days', 'skipped', 'Recent posts exist, no auto-drafts needed');
        }
      } catch (error) {
        await recordAction('no_posts_in_3_days', 'failed', error instanceof Error ? error.message : 'Unknown error');
      }

      // 5) Calendar-aware proactive reminders (next 24h)
      try {
        const start = new Date().toISOString();
        const end = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const { data: upcomingEvents } = await admin
          .from('calendar_events')
          .select('id, title, user_id, start_time')
          .eq('tenant_id', tenantId)
          .gte('start_time', start)
          .lte('start_time', end)
          .limit(30);

        let prepTasks = 0;
        for (const event of upcomingEvents || []) {
          const { error: taskError } = await admin.from('tasks').insert({
            tenant_id: tenantId,
            assigned_to: event.user_id || null,
            title: `Prepare for upcoming meeting: ${event.title || 'Calendar event'}`,
            description: `[AI LOG] ${new Date().toISOString()} Auto-generated preparation task from calendar event ${event.id}.`,
            priority: 'medium',
            status: 'todo',
            due_date: event.start_time,
          });
          if (!taskError) prepTasks += 1;
        }
        await recordAction('calendar_next_24h_prep', 'success', `Found ${(upcomingEvents || []).length} upcoming events, created ${prepTasks} prep tasks`, {
          upcomingEvents: (upcomingEvents || []).length,
          prepTasks,
        });
      } catch (error) {
        await recordAction('calendar_next_24h_prep', 'failed', error instanceof Error ? error.message : 'Unknown error');
      }

      // 6) Payment loop closure (reconciliation candidates)
      try {
        const { data: candidates } = await admin
          .from('business_invoices')
          .select('id, tenant_id, status, metadata, updated_at')
          .eq('tenant_id', tenantId)
          .in('status', ['sent', 'overdue'])
          .limit(50);

        let reconcileTasks = 0;
        let reconciledPaid = 0;
        for (const invoice of candidates || []) {
          const paymentIntentId = (invoice.metadata as Record<string, unknown> | null)?.stripe_payment_intent;
          if (typeof paymentIntentId === 'string' && paymentIntentId.trim()) {
            if (stripe) {
              try {
                const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
                if (paymentIntent.status === 'succeeded') {
                  await admin
                    .from('business_invoices')
                    .update({ status: 'paid', updated_at: new Date().toISOString() })
                    .eq('id', invoice.id)
                    .eq('tenant_id', tenantId);
                  reconciledPaid += 1;
                } else {
                  const { error: taskError } = await admin.from('tasks').insert({
                    tenant_id: tenantId,
                    title: `Reconcile payment status for invoice ${invoice.id}`,
                    description: `[AI LOG] ${new Date().toISOString()} Payment intent status is ${paymentIntent.status}. Continue follow-up.`,
                    priority: 'high',
                    status: 'todo',
                    due_date: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                  });
                  if (!taskError) reconcileTasks += 1;
                }
              } catch {
                const { error: taskError } = await admin.from('tasks').insert({
                  tenant_id: tenantId,
                  title: `Reconcile payment status for invoice ${invoice.id}`,
                  description: `[AI LOG] ${new Date().toISOString()} Stripe reconciliation failed, manual verification required.`,
                  priority: 'high',
                  status: 'todo',
                  due_date: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                });
                if (!taskError) reconcileTasks += 1;
              }
            } else {
              const { error: taskError } = await admin.from('tasks').insert({
                tenant_id: tenantId,
                title: `Reconcile payment status for invoice ${invoice.id}`,
                description: `[AI LOG] ${new Date().toISOString()} Stripe key unavailable. Manual reconciliation required.`,
                priority: 'high',
                status: 'todo',
                due_date: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
              });
              if (!taskError) reconcileTasks += 1;
            }
          }
        }
        await recordAction('payment_loop_reconciliation', 'success', `Auto-reconciled ${reconciledPaid} paid invoices, created ${reconcileTasks} reconciliation tasks`, {
          reconciledPaid,
          reconcileTasks,
        });
      } catch (error) {
        await recordAction('payment_loop_reconciliation', 'failed', error instanceof Error ? error.message : 'Unknown error');
      }

      // Autopilot Auto-Approvals Process
      await processAutopilotApprovals(admin, tenantId, rules, recordAction);

      if (runId) {
        const failedCount = summary.actions.filter((a) => a.status === 'failed').length;
        await admin
          .from('autonomous_runner_runs')
          .update({
            status: failedCount > 0 ? 'partial_success' : 'completed',
            completed_at: new Date().toISOString(),
            summary: { actions: summary.actions },
          })
          .eq('id', runId);
      }

      return { success: true, run: summary };
    } catch (error) {
      return { success: false, run: null, error: error instanceof Error ? error.message : 'Unknown autonomous runner error' };
    }
  },
};

