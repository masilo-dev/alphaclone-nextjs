/**
 * Event Bus - Usage Examples
 * Demonstrates how to integrate the Event Bus into existing services
 */

import { eventBus, eventBusHelpers, EventTypes } from './eventBus';
import type { Event } from './eventBus';

// ============================================
// EXAMPLE 1: Publishing Events
// ============================================

// When a new project is created
export async function onProjectCreated(project: any) {
    await eventBusHelpers.publishProjectEvent('created', project.id, {
        name: project.name,
        ownerId: project.ownerId,
        budget: project.budget
    });
}

// When a user logs in
export async function onUserLogin(userId: string, metadata: any) {
    await eventBusHelpers.publishUserEvent('login', userId, {
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        timestamp: new Date()
    });
}

// When a contract is signed
export async function onContractSigned(contractId: string, signedBy: string) {
    await eventBusHelpers.publishContractEvent('signed', contractId, {
        signedBy,
        signedAt: new Date()
    });
}

// ============================================
// EXAMPLE 2: Subscribing to Events
// ============================================

// Subscribe to all user events
eventBus.subscribe('user.*', async (event: Event) => {
    console.log('User event received:', event.eventType, event.eventData);

    // Log to analytics
    // await analyticsService.track(event);
});

// Subscribe to project creation
eventBus.subscribe(EventTypes.PROJECT_CREATED, async (event: Event) => {
    const { projectId, name, ownerId } = event.eventData;

    // Send welcome email to project owner
    // await emailService.sendProjectWelcome(ownerId, name);

    // Create default tasks
    // await taskService.createDefaultTasks(projectId);

    // Notify team
    // await notificationService.notifyTeam('New project created', { projectId, name });
});

// Subscribe to invoice overdue
eventBus.subscribe(EventTypes.INVOICE_OVERDUE, async (event: Event) => {
    const { invoiceId, clientId, amount } = event.eventData;

    // Send reminder email
    // await emailService.sendOverdueReminder(clientId, invoiceId, amount);

    // Create follow-up task
    // await taskService.create({
    //     title: `Follow up on overdue invoice #${invoiceId}`,
    //     assignedTo: 'admin',
    //     priority: 'high'
    // });
});

// ============================================
// EXAMPLE 3: Workflow Automation
// ============================================

// Auto-onboard new clients
eventBus.subscribe(EventTypes.CLIENT_CREATED, async (event: Event) => {
    const { clientId, email, name } = event.eventData;

    // Step 1: Send welcome email
    console.log(`Sending welcome email to ${email}`);

    // Step 2: Create onboarding project
    console.log(`Creating onboarding project for ${name}`);

    // Step 3: Schedule kickoff meeting
    console.log(`Scheduling kickoff meeting with ${name}`);

    // Step 4: Assign account manager
    console.log(`Assigning account manager to ${name}`);
});

// ============================================
// EXAMPLE 4: Real-time Notifications
// ============================================

// Send real-time notifications for important events
eventBus.subscribe('*', async (event: Event) => {
    // Filter important events
    const importantEvents = [
        EventTypes.CONTRACT_SIGNED,
        EventTypes.INVOICE_PAID,
        EventTypes.PROJECT_COMPLETED,
        EventTypes.MEETING_STARTED
    ];

    if (importantEvents.includes(event.eventType as any)) {
        // Send push notification
        console.log('Sending push notification:', event.eventType);

        // Update dashboard in real-time
        // await realtimeService.broadcast('notification', {
        //     type: event.eventType,
        //     data: event.eventData
        // });
    }
});

// ============================================
// EXAMPLE 5: Analytics & Tracking
// ============================================

// Track all events for analytics
eventBus.subscribe('*', async (event: Event) => {
    // Log to analytics platform
    console.log('[Analytics] Event tracked:', {
        type: event.eventType,
        source: event.eventSource,
        timestamp: event.createdAt
    });

    // Could integrate with:
    // - Google Analytics
    // - Mixpanel
    // - Amplitude
    // - Custom analytics DB
});

// ============================================
// EXAMPLE 6: Audit Logging
// ============================================

// Log all user actions for compliance
eventBus.subscribe('user.*', async (event: Event) => {
    // Store in audit log
    console.log('[Audit] User action:', {
        userId: event.eventData.userId,
        action: event.eventType,
        timestamp: event.createdAt,
        metadata: event.metadata
    });
});

// ============================================
// EXAMPLE 7: Integration with External Services
// ============================================

// Sync with external CRM
eventBus.subscribe(EventTypes.CLIENT_CREATED, async (event: Event) => {
    const { clientId, email, name } = event.eventData;

    // Sync to external CRM (e.g., Salesforce, HubSpot)
    console.log(`Syncing client ${name} to external CRM`);

    // await externalCRM.createContact({
    //     externalId: clientId,
    //     email,
    //     name
    // });
});

// ============================================
// EXAMPLE 8: Error Handling & Retry
// ============================================

eventBus.subscribe(EventTypes.SYSTEM_ERROR, async (event: Event) => {
    const { message, error, context } = event.eventData;

    // Log to error tracking service (Sentry)
    console.error('[Error Tracking]', message, error);

    // Send alert to admin
    // await alertService.sendAdminAlert({
    //     severity: 'high',
    //     message,
    //     context
    // });
});

// ============================================
// EXAMPLE 9: Business Intelligence
// ============================================

// Calculate metrics in real-time
eventBus.subscribe(EventTypes.INVOICE_PAID, async (event: Event) => {
    const { amount, clientId } = event.eventData;

    // Update revenue metrics
    console.log(`Revenue increased by $${amount}`);

    // Update client lifetime value
    // await metricsService.updateClientLTV(clientId, amount);

    // Trigger celebration if milestone reached
    // if (await metricsService.checkMilestone(amount)) {
    //     await notificationService.celebrate('Revenue milestone reached!');
    // }
});

// ============================================
// EXAMPLE 10: Initialize Event Bus
// ============================================

export function initializeEventBus() {
    console.log('[EventBus] Initializing Business OS Event Bus...');

    // Subscribe to all events for debugging (development only)
    if (process.env.NODE_ENV === 'development') {
        eventBus.subscribe('*', async (event: Event) => {
            console.log('[EventBus Debug]', event.eventType, event.eventData);
        });
    }

    console.log('[EventBus] Event Bus initialized successfully');
}
