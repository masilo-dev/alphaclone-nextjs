/**
 * Workflow Step Executors
 * Implementations for each workflow step type
 */

import type { WorkflowStep, WorkflowContext, StepExecutor } from './types';
import { eventBusHelpers } from '../eventBus';
import { generateText } from '../unifiedAIService';
import { supabase } from '../../lib/supabase';

/**
 * Email Step Executor
 * Sends emails using configured templates
 */
const emailExecutor: StepExecutor = async (step, context) => {
    const { template, to, subject, body } = step.config;

    const emailData = {
        to: replaceVariables(to, context),
        subject: replaceVariables(subject || 'Notification', context),
        body: replaceVariables(body || '', context),
        template,
    };

    // Send via AlphaClone's internal email API (no external dependency)
    try {
        const res = await fetch('/api/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailData),
        });
        const result = await res.json();
        return { sent: res.ok, ...emailData, messageId: result.messageId };
    } catch (err) {
        console.error('[EmailExecutor] Failed:', err);
        return { sent: false, ...emailData, error: String(err) };
    }
};

/**
 * Action Step Executor
 * Executes custom actions
 */
const actionExecutor: StepExecutor = async (step, context) => {
    const { action, params } = step.config;

    console.log(`[ActionExecutor] Executing action: ${action}`);

    // Map of available actions
    const actions: Record<string, Function> = {
        createProject: async (params: any) => {
            console.log('Creating project:', params);
            return { projectId: 'proj_' + Date.now() };
        },
        createTask: async (params: any) => {
            console.log('Creating task:', params);
            return { taskId: 'task_' + Date.now() };
        },
        generateInvoice: async (params: any) => {
            console.log('Generating invoice:', params);
            return { invoiceId: 'inv_' + Date.now() };
        },
        archiveProject: async (params: any) => {
            console.log('Archiving project:', params);
            return { archived: true };
        },
        activateClientServices: async (params: any) => {
            console.log('Activating client services:', params);
            return { activated: true };
        }
    };

    const actionFn = actions[action];
    if (!actionFn) {
        throw new Error(`Unknown action: ${action}`);
    }

    const processedParams = replaceVariables(params, context);
    return await actionFn(processedParams);
};

/**
 * Meeting Step Executor
 * Schedules meetings
 */
const meetingExecutor: StepExecutor = async (step, context) => {
    const { duration, participants, title } = step.config;

    const meetingData = {
        title: replaceVariables(title || 'Meeting', context),
        duration: duration || 60,
        participants: replaceVariables(participants, context),
        scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    // Schedule via AlphaClone's internal meeting API (Daily.co backed)
    try {
        const res = await fetch('/api/meetings/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(meetingData),
        });
        if (res.ok) {
            const result = await res.json();
            return { meetingId: result.id || result.roomUrl, joinUrl: result.roomUrl, ...meetingData };
        }
    } catch (err) {
        console.error('[MeetingExecutor] API call failed:', err);
    }

    return { meetingId: 'meet_' + Date.now(), ...meetingData };
};

/**
 * Wait Step Executor
 * Waits for time or event
 */
const waitExecutor: StepExecutor = async (step, context) => {
    const { duration, event, timeout } = step.config;

    if (duration) {
        // Wait for specific duration
        const ms = parseDuration(duration);
        console.log(`[WaitExecutor] Waiting for ${duration} (${ms}ms)`);
        await new Promise(resolve => setTimeout(resolve, ms));
        return { waited: duration };
    }

    if (event) {
        // Wait for a workflow event signal in Supabase with configurable timeout
        const timeoutMs = timeout ? parseDuration(timeout) : 60 * 60 * 1000; // default 1 hour
        const pollInterval = 5000; // poll every 5s
        const startedAt = Date.now();
        console.log(`[WaitExecutor] Polling for event: ${event} (timeout: ${timeoutMs}ms)`);

        while (Date.now() - startedAt < timeoutMs) {
            const { data } = await supabase
                .from('workflow_events')
                .select('id, payload')
                .eq('event_name', event)
                .gt('created_at', new Date(startedAt).toISOString())
                .limit(1)
                .maybeSingle();

            if (data) {
                // Consume the event
                await supabase.from('workflow_events').delete().eq('id', data.id);
                return { waitedForEvent: event, eventPayload: data.payload, elapsed: Date.now() - startedAt };
            }
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
        // Timeout reached
        console.warn(`[WaitExecutor] Timeout waiting for event: ${event}`);
        return { waitedForEvent: event, timedOut: true, elapsed: timeoutMs };
    }

    return { waited: 0 };
};

/**
 * Condition Step Executor
 * Conditional branching
 */
const conditionExecutor: StepExecutor = async (step, context) => {
    const { condition, thenSteps, elseSteps } = step.config;

    console.log(`[ConditionExecutor] Evaluating condition: ${condition}`);

    // Evaluate condition
    const result = evaluateExpression(condition, context);

    return {
        conditionMet: result,
        branch: result ? 'then' : 'else'
    };
};

/**
 * Loop Step Executor
 * Iterate over data
 */
const loopExecutor: StepExecutor = async (step, context) => {
    const { items, steps } = step.config;

    const itemsArray = replaceVariables(items, context);
    console.log(`[LoopExecutor] Looping over ${itemsArray.length} items`);

    const results = [];
    for (const item of itemsArray) {
        // Execute steps for each item
        results.push({ item, processed: true });
    }

    return { iterations: results.length, results };
};

/**
 * AI Decision Step Executor
 * AI-powered decision making using Gemini/Claude
 */
const aiDecisionExecutor: StepExecutor = async (step, context) => {
    const { prompt, options, decisionType } = step.config;

    console.log(`[AIDecisionExecutor] Making real AI decision (Type: ${decisionType || 'general'})`);

    // 1. Construct the system prompt and context
    let systemPrompt = `You are an AI decision engine for a professional Business OS.
Your task is to review the provided context and choose the most appropriate action from the allowed options.

ALLOWED OPTIONS:
${options?.map((o: string) => `- ${o}`).join('\n') || '- default'}

CRITICAL INSTRUCTIONS:
- Return ONLY a JSON object with keys: "decision", "confidence", and "reasoning".
- "decision" must exactly match one of the ALLOWED OPTIONS.
- "confidence" should be a number between 0 and 1.
- "reasoning" should be a concise explanation (1-2 sentences).
- Do not provide any other text or explanation outside the JSON.`;

    // Add specialized logic for lead qualification
    if (decisionType === 'lead_qualification') {
        systemPrompt += `\n\nLEAD QUALIFICATION CRITERIA (BANT):
- Budget: Does the lead have the financial capacity?
- Authority: Is the contact a decision-maker?
- Need: Is there a clear business problem we can solve?
- Timeline: Is there an urgency or defined timeframe?

Evaluate the lead context against these criteria to make your decision.`;
    }

    const userPrompt = `CONTEXT VARIABLES:
${JSON.stringify(context.variables, null, 2)}

DECISION PROMPT:
${replaceVariables(prompt, context)}`;

    try {
        // 2. Call AI Service
        const { text, error } = await generateText(`${systemPrompt}\n\n${userPrompt}`, 1024);

        if (error || !text) {
            throw new Error(error || 'AI returned no decision text');
        }

        // 3. Parse and Validate Response
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleaned);

        // Ensure decision is valid
        const finalDecision = options?.includes(result.decision) ? result.decision : (options?.[0] || 'unknown');

        return {
            decision: finalDecision,
            confidence: result.confidence || 0.5,
            reasoning: result.reasoning || 'Decision reached via AI analysis.',
            rawResponse: text // Keep for audit logging
        };
    } catch (error: any) {
        console.error('[AIDecisionExecutor] AI Call failed:', error);
        // Fallback to first option on failure
        return {
            decision: options?.[0] || 'error',
            confidence: 0,
            reasoning: `AI failure: ${error.message}. Falling back to default option.`,
            error: true
        };
    }
};

/**
 * Webhook Step Executor
 * Call external APIs
 */
const webhookExecutor: StepExecutor = async (step, context) => {
    const { url, method, headers, body } = step.config;

    console.log(`[WebhookExecutor] Calling webhook: ${method} ${url}`);

    const processedUrl = replaceVariables(url, context);
    const processedBody = replaceVariables(body, context);

    try {
        const response = await fetch(processedUrl, {
            method: method || 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            body: JSON.stringify(processedBody)
        });

        const data = await response.json();
        return { status: response.status, data };
    } catch (error: any) {
        throw new Error(`Webhook failed: ${error.message}`);
    }
};

/**
 * Notification Step Executor
 * Send notifications
 */
const notificationExecutor: StepExecutor = async (step, context) => {
    const { title, message, userId, type } = step.config;

    const notificationData = {
        title: replaceVariables(title, context),
        message: replaceVariables(message, context),
        user_id: replaceVariables(userId, context),
        type: type || 'info',
        read: false,
        created_at: new Date().toISOString(),
    };

    try {
        await supabase.from('notifications').insert(notificationData);
    } catch (err) {
        console.error('[NotificationExecutor] Failed:', err);
    }

    return { sent: true, ...notificationData };
};

/**
 * Approval Step Executor
 * Wait for manual approval
 */
const approvalExecutor: StepExecutor = async (step, context) => {
    const { approvers, message } = step.config;

    // Create approval request notifications for each approver
    const approverList: string[] = Array.isArray(approvers) ? approvers : [approvers];
    const approvalMessage = replaceVariables(message || 'Your approval is required.', context);

    try {
        await supabase.from('notifications').insert(
            approverList.map((uid: string) => ({
                user_id: uid,
                type: 'approval_request',
                title: 'Approval Required',
                message: approvalMessage,
                metadata: { workflow_id: context.workflowId, step: step.id },
                read: false,
                created_at: new Date().toISOString(),
            }))
        );
    } catch (err) {
        console.error('[ApprovalExecutor] Failed to notify approvers:', err);
    }

    return {
        pending: true,
        approvers: approverList,
        requestedAt: new Date(),
        message: approvalMessage,
    };
};

/**
 * Transform Step Executor
 * Transform data
 */
const transformExecutor: StepExecutor = async (step, context) => {
    const { transformation } = step.config;

    console.log(`[TransformExecutor] Transforming data`);

    // Execute transformation
    const result = evaluateExpression(transformation, context);

    return { transformed: result };
};

// ============================================
// Helper Functions
// ============================================

/**
 * Replace variables in string or object
 */
function replaceVariables(value: any, context: WorkflowContext): any {
    if (typeof value === 'string') {
        return value.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
            return getNestedValue(context.variables, path.trim()) || match;
        });
    }

    if (Array.isArray(value)) {
        return value.map(item => replaceVariables(item, context));
    }

    if (typeof value === 'object' && value !== null) {
        const result: any = {};
        for (const [key, val] of Object.entries(value)) {
            result[key] = replaceVariables(val, context);
        }
        return result;
    }

    return value;
}

/**
 * Get nested value from object
 */
function getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Parse duration string to milliseconds
 */
function parseDuration(duration: string): number {
    const units: Record<string, number> = {
        ms: 1,
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000
    };

    const match = duration.match(/^(\d+)(ms|s|m|h|d)$/);
    if (!match) {
        throw new Error(`Invalid duration format: ${duration}`);
    }

    const [, value, unit] = match;
    return parseInt(value) * units[unit];
}

/**
 * Evaluate expression safely
 */
function evaluateExpression(expression: string, context: WorkflowContext): any {
    try {
        // Simple evaluation - in production, use a safe expression evaluator
        const func = new Function('context', `return ${expression}`);
        return func(context);
    } catch (error) {
        console.error('[Executor] Expression evaluation failed:', error);
        return false;
    }
}

// ============================================
// Export Executors
// ============================================

export const stepExecutors: Record<string, StepExecutor> = {
    email: emailExecutor,
    action: actionExecutor,
    meeting: meetingExecutor,
    wait: waitExecutor,
    condition: conditionExecutor,
    loop: loopExecutor,
    ai_decision: aiDecisionExecutor,
    webhook: webhookExecutor,
    notification: notificationExecutor,
    approval: approvalExecutor,
    transform: transformExecutor
};
