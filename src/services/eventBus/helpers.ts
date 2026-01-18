/**
 * Event Bus - Helper Functions
 * Utility functions for common event operations
 */

import { eventBus } from './EventBus';
import { EventTypes } from './types';
import type { PublishEventOptions } from './types';

class EventBusHelpers {
    /**
     * Publish a user event
     */
    async publishUserEvent(
        action: 'created' | 'updated' | 'deleted' | 'login' | 'logout',
        userId: string,
        data?: any
    ): Promise<string> {
        const eventTypeMap = {
            created: EventTypes.USER_CREATED,
            updated: EventTypes.USER_UPDATED,
            deleted: EventTypes.USER_DELETED,
            login: EventTypes.USER_LOGIN,
            logout: EventTypes.USER_LOGOUT
        };

        return eventBus.publish({
            eventType: eventTypeMap[action],
            eventSource: 'user_service',
            eventData: { userId, ...data }
        });
    }

    /**
     * Publish a project event
     */
    async publishProjectEvent(
        action: 'created' | 'updated' | 'deleted' | 'completed' | 'archived',
        projectId: string,
        data?: any
    ): Promise<string> {
        const eventTypeMap = {
            created: EventTypes.PROJECT_CREATED,
            updated: EventTypes.PROJECT_UPDATED,
            deleted: EventTypes.PROJECT_DELETED,
            completed: EventTypes.PROJECT_COMPLETED,
            archived: EventTypes.PROJECT_ARCHIVED
        };

        return eventBus.publish({
            eventType: eventTypeMap[action],
            eventSource: 'project_service',
            eventData: { projectId, ...data }
        });
    }

    /**
     * Publish a message event
     */
    async publishMessageEvent(
        action: 'sent' | 'read' | 'deleted',
        messageId: string,
        data?: any
    ): Promise<string> {
        const eventTypeMap = {
            sent: EventTypes.MESSAGE_SENT,
            read: EventTypes.MESSAGE_READ,
            deleted: EventTypes.MESSAGE_DELETED
        };

        return eventBus.publish({
            eventType: eventTypeMap[action],
            eventSource: 'message_service',
            eventData: { messageId, ...data }
        });
    }

    /**
     * Publish a meeting event
     */
    async publishMeetingEvent(
        action: 'scheduled' | 'started' | 'ended' | 'cancelled',
        meetingId: string,
        data?: any
    ): Promise<string> {
        const eventTypeMap = {
            scheduled: EventTypes.MEETING_SCHEDULED,
            started: EventTypes.MEETING_STARTED,
            ended: EventTypes.MEETING_ENDED,
            cancelled: EventTypes.MEETING_CANCELLED
        };

        return eventBus.publish({
            eventType: eventTypeMap[action],
            eventSource: 'meeting_service',
            eventData: { meetingId, ...data }
        });
    }

    /**
     * Publish a contract event
     */
    async publishContractEvent(
        action: 'created' | 'sent' | 'signed' | 'expired',
        contractId: string,
        data?: any
    ): Promise<string> {
        const eventTypeMap = {
            created: EventTypes.CONTRACT_CREATED,
            sent: EventTypes.CONTRACT_SENT,
            signed: EventTypes.CONTRACT_SIGNED,
            expired: EventTypes.CONTRACT_EXPIRED
        };

        return eventBus.publish({
            eventType: eventTypeMap[action],
            eventSource: 'contract_service',
            eventData: { contractId, ...data }
        });
    }

    /**
     * Publish an invoice event
     */
    async publishInvoiceEvent(
        action: 'created' | 'sent' | 'paid' | 'overdue',
        invoiceId: string,
        data?: any
    ): Promise<string> {
        const eventTypeMap = {
            created: EventTypes.INVOICE_CREATED,
            sent: EventTypes.INVOICE_SENT,
            paid: EventTypes.INVOICE_PAID,
            overdue: EventTypes.INVOICE_OVERDUE
        };

        return eventBus.publish({
            eventType: eventTypeMap[action],
            eventSource: 'invoice_service',
            eventData: { invoiceId, ...data }
        });
    }

    /**
     * Publish a task event
     */
    async publishTaskEvent(
        action: 'created' | 'updated' | 'completed' | 'assigned',
        taskId: string,
        data?: any
    ): Promise<string> {
        const eventTypeMap = {
            created: EventTypes.TASK_CREATED,
            updated: EventTypes.TASK_UPDATED,
            completed: EventTypes.TASK_COMPLETED,
            assigned: EventTypes.TASK_ASSIGNED
        };

        return eventBus.publish({
            eventType: eventTypeMap[action],
            eventSource: 'task_service',
            eventData: { taskId, ...data }
        });
    }

    /**
     * Publish a workflow event
     */
    async publishWorkflowEvent(
        action: 'started' | 'step_completed' | 'completed' | 'failed',
        workflowId: string,
        data?: any
    ): Promise<string> {
        const eventTypeMap = {
            started: EventTypes.WORKFLOW_STARTED,
            step_completed: EventTypes.WORKFLOW_STEP_COMPLETED,
            completed: EventTypes.WORKFLOW_COMPLETED,
            failed: EventTypes.WORKFLOW_FAILED
        };

        return eventBus.publish({
            eventType: eventTypeMap[action],
            eventSource: 'workflow_service',
            eventData: { workflowId, ...data }
        });
    }

    /**
     * Publish a client event
     */
    async publishClientEvent(
        action: 'created' | 'updated' | 'onboarded',
        clientId: string,
        data?: any
    ): Promise<string> {
        const eventTypeMap = {
            created: EventTypes.CLIENT_CREATED,
            updated: EventTypes.CLIENT_UPDATED,
            onboarded: EventTypes.CLIENT_ONBOARDED
        };

        return eventBus.publish({
            eventType: eventTypeMap[action],
            eventSource: 'client_service',
            eventData: { clientId, ...data }
        });
    }

    /**
     * Publish a system event
     */
    async publishSystemEvent(
        level: 'error' | 'warning' | 'info',
        message: string,
        data?: any
    ): Promise<string> {
        const eventTypeMap = {
            error: EventTypes.SYSTEM_ERROR,
            warning: EventTypes.SYSTEM_WARNING,
            info: EventTypes.SYSTEM_INFO
        };

        return eventBus.publish({
            eventType: eventTypeMap[level],
            eventSource: 'system',
            eventData: { message, ...data }
        });
    }
}

export const eventBusHelpers = new EventBusHelpers();
