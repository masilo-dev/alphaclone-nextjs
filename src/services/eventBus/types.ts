/**
 * Event Bus System - Core Types
 * Central type definitions for the Business OS event system
 */

// Event status types
export type EventStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Handler types
export type HandlerType = 'function' | 'workflow' | 'webhook' | 'plugin';

// Base Event interface
export interface Event {
    id: string;
    eventType: string;
    eventSource: string;
    eventData: any;
    metadata?: Record<string, any>;
    createdAt: Date;
    processedAt?: Date;
    status: EventStatus;
    retryCount?: number;
    errorMessage?: string;
}

// Event Subscription
export interface EventSubscription {
    id: string;
    subscriberName: string;
    eventPattern: string;
    handlerConfig: Record<string, any>;
    isActive: boolean;
    priority: number;
    createdAt: Date;
    updatedAt: Date;
}

// Event Handler
export interface EventHandler {
    id: string;
    name: string;
    description?: string;
    handlerType: HandlerType;
    config: Record<string, any>;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// Event Log
export interface EventLog {
    id: string;
    eventId: string;
    subscriptionId?: string;
    handlerName?: string;
    status: EventStatus;
    executionTimeMs?: number;
    errorMessage?: string;
    createdAt: Date;
}

// Event Handler Function signature
export type EventHandlerFunction = (event: Event) => Promise<void>;

// Event Publisher options
export interface PublishEventOptions {
    eventType: string;
    eventSource: string;
    eventData: any;
    metadata?: Record<string, any>;
}

// Standard Event Types (extensible)
export const EventTypes = {
    // User events
    USER_CREATED: 'user.created',
    USER_UPDATED: 'user.updated',
    USER_DELETED: 'user.deleted',
    USER_LOGIN: 'user.login',
    USER_LOGOUT: 'user.logout',

    // Project events
    PROJECT_CREATED: 'project.created',
    PROJECT_UPDATED: 'project.updated',
    PROJECT_DELETED: 'project.deleted',
    PROJECT_COMPLETED: 'project.completed',
    PROJECT_ARCHIVED: 'project.archived',

    // Message events
    MESSAGE_SENT: 'message.sent',
    MESSAGE_READ: 'message.read',
    MESSAGE_DELETED: 'message.deleted',

    // Meeting events
    MEETING_SCHEDULED: 'meeting.scheduled',
    MEETING_STARTED: 'meeting.started',
    MEETING_ENDED: 'meeting.ended',
    MEETING_CANCELLED: 'meeting.cancelled',

    // Contract events
    CONTRACT_CREATED: 'contract.created',
    CONTRACT_SENT: 'contract.sent',
    CONTRACT_SIGNED: 'contract.signed',
    CONTRACT_EXPIRED: 'contract.expired',

    // Invoice events
    INVOICE_CREATED: 'invoice.created',
    INVOICE_SENT: 'invoice.sent',
    INVOICE_PAID: 'invoice.paid',
    INVOICE_OVERDUE: 'invoice.overdue',

    // Task events
    TASK_CREATED: 'task.created',
    TASK_UPDATED: 'task.updated',
    TASK_COMPLETED: 'task.completed',
    TASK_ASSIGNED: 'task.assigned',

    // Workflow events
    WORKFLOW_STARTED: 'workflow.started',
    WORKFLOW_STEP_COMPLETED: 'workflow.step.completed',
    WORKFLOW_COMPLETED: 'workflow.completed',
    WORKFLOW_FAILED: 'workflow.failed',

    // Client events
    CLIENT_CREATED: 'client.created',
    CLIENT_UPDATED: 'client.updated',
    CLIENT_ONBOARDED: 'client.onboarded',

    // System events
    SYSTEM_ERROR: 'system.error',
    SYSTEM_WARNING: 'system.warning',
    SYSTEM_INFO: 'system.info',
} as const;

export type EventType = typeof EventTypes[keyof typeof EventTypes];
