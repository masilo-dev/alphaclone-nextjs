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
    logoUrl?: string;
    settings: TenantSettings;
    subscriptionPlan: SubscriptionPlan;
    subscriptionStatus: SubscriptionStatus;
    trialEndsAt?: Date;
    createdAt: Date;
    updatedAt: Date;
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
}

// Subscription Plans
// Subscription Plans
export type SubscriptionPlan = 'free' | 'basic' | 'starter' | 'pro' | 'professional' | 'premium' | 'enterprise';

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
    workflows: boolean;
    aiAssistant: boolean;
    videoConferencing: boolean;
    customDomain: boolean;
    prioritySupport: boolean;
    apiAccess: boolean;
}

// Plan Pricing
export const PLAN_PRICING: Record<SubscriptionPlan, { monthly: number; yearly: number; features: PlanFeatures }> = {
    free: {
        monthly: 0,
        yearly: 0,
        features: {
            maxUsers: 1,
            maxProjects: 3,
            maxStorage: 1,
            workflows: false,
            aiAssistant: false,
            videoConferencing: false,
            customDomain: false,
            prioritySupport: false,
            apiAccess: false
        }
    },
    basic: { // Alias for Starter in some contexts
        monthly: 16,
        yearly: 160,
        features: {
            maxUsers: 5,
            maxProjects: 10,
            maxStorage: 5,
            workflows: true,
            aiAssistant: false,
            videoConferencing: true,
            customDomain: false,
            prioritySupport: false,
            apiAccess: false
        }
    },
    starter: {
        monthly: 16,
        yearly: 160,
        features: {
            maxUsers: 5,
            maxProjects: 10,
            maxStorage: 5,
            workflows: true,
            aiAssistant: false,
            videoConferencing: true,
            customDomain: false,
            prioritySupport: false,
            apiAccess: false
        }
    },
    pro: { // Alias for Professional
        monthly: 48,
        yearly: 480,
        features: {
            maxUsers: 25,
            maxProjects: 50,
            maxStorage: 25,
            workflows: true,
            aiAssistant: true,
            videoConferencing: true,
            customDomain: true,
            prioritySupport: true,
            apiAccess: true
        }
    },
    professional: {
        monthly: 48,
        yearly: 480,
        features: {
            maxUsers: 25,
            maxProjects: 50,
            maxStorage: 25,
            workflows: true,
            aiAssistant: true,
            videoConferencing: true,
            customDomain: true,
            prioritySupport: true,
            apiAccess: true
        }
    },
    premium: {
        monthly: 80,
        yearly: 800,
        features: {
            maxUsers: -1, // unlimited
            maxProjects: -1, // unlimited
            maxStorage: -1, // unlimited
            workflows: true,
            aiAssistant: true,
            videoConferencing: true,
            customDomain: true,
            prioritySupport: true,
            apiAccess: true
        }
    },
    enterprise: {
        monthly: 299,
        yearly: 2990,
        features: {
            maxUsers: -1,
            maxProjects: -1,
            maxStorage: -1,
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
