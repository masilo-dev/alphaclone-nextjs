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
}

// Subscription Plans
export type SubscriptionPlan = 'free' | 'starter' | 'professional' | 'enterprise';

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
            maxUsers: 3,
            maxProjects: 5,
            maxStorage: 1,
            workflows: false,
            aiAssistant: false,
            videoConferencing: true,
            customDomain: false,
            prioritySupport: false,
            apiAccess: false
        }
    },
    starter: {
        monthly: 29,
        yearly: 290,
        features: {
            maxUsers: 10,
            maxProjects: 25,
            maxStorage: 10,
            workflows: true,
            aiAssistant: false,
            videoConferencing: true,
            customDomain: false,
            prioritySupport: false,
            apiAccess: true
        }
    },
    professional: {
        monthly: 99,
        yearly: 990,
        features: {
            maxUsers: 50,
            maxProjects: 100,
            maxStorage: 100,
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
    }
};
