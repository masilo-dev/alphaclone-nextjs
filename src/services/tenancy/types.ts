/**
 * Multi-Tenancy - Core Types
 * Type definitions for the multi-tenant system
 */

// Tenant
export interface Tenant {
    id: string;
    name: string;
    slug: string;
    domain?: string;
    logo_url?: string;
    settings: TenantSettings;
    subscription_plan: SubscriptionPlan;
    subscription_status: SubscriptionStatus;
    trial_ends_at?: Date;
    current_period_end?: Date;
    deletion_pending_at?: Date;
    stripe_customer_id?: string;
    admin_user_id?: string;
    cancel_at_period_end?: boolean;
    created_at: Date;
    updated_at: Date;
}

// Tenant Settings
export interface TenantSettings {
    branding?: {
        primaryColor?: string;
        secondaryColor?: string;
        logo?: string;
        favicon?: string;
    };
    features?: {
        workflows?: boolean;
        aiAssistant?: boolean;
        videoConferencing?: boolean;
        customDomain?: boolean;
    };
    limits?: {
        maxUsers?: number;
        maxProjects?: number;
        maxStorage?: number; // in GB
    };
    notifications?: {
        email?: boolean;
        sms?: boolean;
        push?: boolean;
    };
    booking?: {
        enabled: boolean;
        slug: string;
        availability: {
            days: number[]; // 0=Sunday, 1=Monday, etc.
            hours: { start: string; end: string }; // "09:00", "17:00"
            timezone?: string; // e.g. "America/New_York", default "UTC"
        };
        meetingTypes: {
            id: string;
            name: string; // "15 Min Intro", "Consultation"
            duration: number; // minutes
            price: number; // 0 for free
            description?: string;
        }[];
        // Logic Settings
        bufferTime?: number; // default 15 mins
        minNotice?: number; // default 4 hours
        futureLimit?: number; // default 60 days
    };
    calendly?: {
        enabled: boolean;
        accessToken?: string;
        refreshToken?: string;
        expiresAt?: string;
        calendlyUserUri?: string;
        eventUrl?: string; // Default event link for the tenant
    };
    billing_email?: string;
}

// Subscription Plans
// Subscription Plans
export type SubscriptionPlan = 'free' | 'starter' | 'pro' | 'enterprise' | 'custom';

export type SubscriptionStatus = 'active' | 'cancelled' | 'suspended' | 'trial';

// Tenant User
export interface TenantUser {
    id: string;
    tenantId: string;
    userId: string;
    role: TenantRole;
    permissions: string[];
    joinedAt: Date;
}

// Tenant Roles
export type TenantRole = 'owner' | 'admin' | 'member' | 'guest';

// Tenant Subscription
export interface TenantSubscription {
    id: string;
    tenantId: string;
    planName: string;
    billingCycle: 'monthly' | 'yearly';
    amount: number;
    currency: string;
    status: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    stripeSubscriptionId?: string;
    stripeCustomerId?: string;
    createdAt: Date;
    updatedAt: Date;
}

// Tenant Usage
export interface TenantUsage {
    id: string;
    tenantId: string;
    metricName: string;
    metricValue: number;
    periodStart: Date;
    periodEnd: Date;
    createdAt: Date;
}

// Tenant Invitation
export interface TenantInvitation {
    id: string;
    tenantId: string;
    email: string;
    role: TenantRole;
    invitedBy?: string;
    token: string;
    expiresAt: Date;
    acceptedAt?: Date;
    createdAt: Date;
}

// Tenant Context (for current session)
export interface TenantContext {
    tenantId: string;
    userId: string;
    role: TenantRole;
    permissions: string[];
}

// Plan Features
export interface PlanFeatures {
    maxUsers: number;
    maxProjects: number;
    maxStorage: number; // GB
    maxVideoMeetingsPerMonth: number;
    maxVideoMinutesPerMeeting: number;
    contractGeneration: boolean;
    paymentProcessing: boolean;
    fullCRM: boolean;
    advancedBookings: boolean;
    workflows: boolean;
    aiAssistant: boolean;
    videoConferencing: boolean;
    customDomain: boolean;
    prioritySupport: boolean;
    apiAccess: boolean;
}

// Plan Pricing
export const PLAN_PRICING: Record<SubscriptionPlan, { monthly: number; yearly: number; features: PlanFeatures; stripePriceId?: string }> = {
    free: {
        monthly: 0,
        yearly: 0,
        features: {
            maxUsers: 1,
            maxProjects: 3,
            maxStorage: 1,
            maxVideoMeetingsPerMonth: 2,
            maxVideoMinutesPerMeeting: 30,
            contractGeneration: false,
            paymentProcessing: false,
            fullCRM: false,
            advancedBookings: false,
            workflows: false,
            aiAssistant: false,
            videoConferencing: true,
            customDomain: false,
            prioritySupport: false,
            apiAccess: false
        }
    },
    starter: {
        monthly: 25,
        yearly: 250,
        stripePriceId: 'price_starter_monthly',
        features: {
            maxUsers: 5,
            maxProjects: 25,
            maxStorage: 10,
            maxVideoMeetingsPerMonth: 10,
            maxVideoMinutesPerMeeting: 60,
            contractGeneration: false,
            paymentProcessing: true,
            fullCRM: false,
            advancedBookings: true,
            workflows: true,
            aiAssistant: false,
            videoConferencing: true,
            customDomain: false,
            prioritySupport: false,
            apiAccess: false
        }
    },
    pro: {
        monthly: 89,
        yearly: 890,
        stripePriceId: 'price_pro_monthly',
        features: {
            maxUsers: 20,
            maxProjects: 100,
            maxStorage: 50,
            maxVideoMeetingsPerMonth: 50,
            maxVideoMinutesPerMeeting: 90,
            contractGeneration: true,
            paymentProcessing: true,
            fullCRM: true,
            advancedBookings: true,
            workflows: true,
            aiAssistant: true,
            videoConferencing: true,
            customDomain: true,
            prioritySupport: true,
            apiAccess: true
        }
    },
    enterprise: {
        monthly: 200,
        yearly: 2000,
        stripePriceId: 'price_enterprise_monthly',
        features: {
            maxUsers: -1,
            maxProjects: -1,
            maxStorage: 500,
            maxVideoMeetingsPerMonth: 200,
            maxVideoMinutesPerMeeting: 180,
            contractGeneration: true,
            paymentProcessing: true,
            fullCRM: true,
            advancedBookings: true,
            workflows: true,
            aiAssistant: true,
            videoConferencing: true,
            customDomain: true,
            prioritySupport: true,
            apiAccess: true
        }
    },
    custom: {
        monthly: 0, // Quote based
        yearly: 0,
        features: {
            maxUsers: -1,
            maxProjects: -1,
            maxStorage: -1,
            maxVideoMeetingsPerMonth: -1, // Unlimited
            maxVideoMinutesPerMeeting: -1, // Unlimited
            contractGeneration: true,
            paymentProcessing: true,
            fullCRM: true,
            advancedBookings: true,
            workflows: true,
            aiAssistant: true,
            videoConferencing: true,
            customDomain: true,
            prioritySupport: true,
            apiAccess: true
        }
    }
};

export const TRIAL_LIMITS = {
    MAX_MEETINGS: 2,
    MAX_MEETING_DURATION_MINS: 50,
    MAX_LEADS_PER_DAY: 20,
    MAX_TOTAL_LEADS: 100,
    TRIAL_DAYS: 14
};
