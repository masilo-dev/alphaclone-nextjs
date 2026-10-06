import React, { useState } from 'react';
import { Modal } from '../ui/UIComponents';
import {
    BriefcaseBusiness,
    FileText,
    FolderKanban,
    Mail,
    Search,
    Share2,
    Sparkles,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { User as UserType } from '../../types';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface OnboardingFlowProps {
    user: UserType;
    onComplete: (nextPath?: string) => void;
}

interface OnboardingGoal {
    id: string;
    title: string;
    description: string;
    nextStep: string;
    href: string;
    icon: LucideIcon;
}

/**
 * First-use choices intentionally describe business outcomes rather than AlphaClone modules.
 * Each destination remains an existing tenant-scoped dashboard route.
 */
const ONBOARDING_GOALS: OnboardingGoal[] = [
    {
        id: 'get_customers',
        title: 'Get more customers',
        description: 'Find local businesses or people who may be a good fit, then save the best ones.',
        nextStep: 'Start by describing the customers you want to reach.',
        href: '/dashboard/leads/campaigns',
        icon: Search,
    },
    {
        id: 'post_to_social',
        title: 'Post to social media',
        description: 'Create, review, and publish an update on your connected social accounts.',
        nextStep: 'Choose the account and prepare your first post.',
        href: '/dashboard/business/social/compose',
        icon: Share2,
    },
    {
        id: 'send_promotions',
        title: 'Send emails and promotions',
        description: 'Choose recipients, write a message, review it, and send it from your business email.',
        nextStep: 'Create a small, reviewable campaign.',
        href: '/dashboard/business/campaigns',
        icon: Mail,
    },
    {
        id: 'manage_customers',
        title: 'Manage customers and enquiries',
        description: 'Keep customer details, conversations, and follow-ups in one place.',
        nextStep: 'Add your first customer or enquiry.',
        href: '/dashboard/crm/workspace?quickAdd=true',
        icon: Users,
    },
    {
        id: 'create_invoices',
        title: 'Create quotes and invoices',
        description: 'Prepare professional bills and keep track of payments.',
        nextStep: 'Create a draft invoice before you send it.',
        href: '/dashboard/business/billing/manage?create=true',
        icon: FileText,
    },
    {
        id: 'manage_projects',
        title: 'Manage projects and tasks',
        description: 'Plan client work, organize tasks, and see what needs attention.',
        nextStep: 'Create the first piece of work to track.',
        href: '/dashboard/business/projects/manage?create=true',
        icon: FolderKanban,
    },
    {
        id: 'run_business',
        title: 'Run my business in one workspace',
        description: 'Start from your home view and add the tools that matter as you need them.',
        nextStep: 'Open your workspace and choose one priority.',
        href: '/dashboard',
        icon: BriefcaseBusiness,
    },
];

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ user, onComplete }) => {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showAllGoals, setShowAllGoals] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const saveChoice = async (choice: string, nextPath?: string) => {
        if (isSaving) return;

        setSelectedId(choice);
        setIsSaving(true);
        setSaveError(null);
        const toastId = toast.loading('Saving your starting point...');

        try {
            const profileResponse = await fetch('/api/account/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ onboardingRole: choice, onboardingCompleted: true }),
            });
            const profilePayload = await profileResponse.json().catch(() => ({}));
            if (!profileResponse.ok) {
                throw new Error(profilePayload.error || 'Your choice could not be saved.');
            }

            const { error: metadataError } = await supabase.auth.updateUser({
                data: {
                    onboarding_role: choice,
                    onboarding_completed: true,
                },
            });
            if (metadataError) throw metadataError;

            // This is an optimistic cache only. The profile remains the durable source of truth.
            localStorage.setItem(`onboarding_completed_${user.id}`, 'true');
            localStorage.setItem(`onboarding_goal_${user.id}`, choice);
            window.dispatchEvent(new CustomEvent('alphaclone:onboarding-updated'));
            toast.success(nextPath ? 'Your first path is ready.' : 'Your full workspace is ready.', { id: toastId });
            onComplete(nextPath);
        } catch (err) {
            console.error('OnboardingFlow: Update failed:', err);
            const message = err instanceof Error ? err.message : 'Your choice could not be saved.';
            setSaveError(`${message} Please refresh to check whether your choice was saved before trying again.`);
            toast.error('We could not save your starting point.', { id: toastId });
            setSelectedId(null);
        } finally {
            setIsSaving(false);
        }
    };

    const handleGoalSelect = (goal: OnboardingGoal) => saveChoice(goal.id, goal.href);
    const handleExploreWorkspace = () => saveChoice('explore_workspace');

    return (
        <Modal
            isOpen={true}
            onClose={handleExploreWorkspace}
            title="Get started with AlphaClone"
            className="max-w-2xl overflow-hidden rounded-[var(--ws-radius-lg)] border border-[var(--ws-border)] bg-[var(--ws-panel)] shadow-xl"
        >
            <div className="relative p-4 sm:p-6">
                <div className="mb-5 space-y-2 text-center">
                    <div className="mx-auto inline-flex items-center justify-center rounded-2xl bg-[var(--brand-blue-500,var(--brand-blue-500))]/15 p-3 text-[var(--brand-blue-400,var(--brand-blue-300))]">
                        <Sparkles className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <p className="type-caption font-semibold uppercase tracking-caps text-[var(--brand-blue-400,var(--brand-blue-300))]">Account created · Choose your first direction</p>
                    <h2 className="text-xl font-semibold tracking-tight text-[var(--ws-text-primary)] sm:text-2xl">
                        What do you want AlphaClone to do for your business?
                    </h2>
                    <p className="text-[var(--ws-text-muted)] type-card-description sm:text-base max-w-2xl mx-auto">
                        Connect your tools → Direct AlphaClone → Approve the action → Execute → Verify the result. Start with one useful outcome.
                    </p>
                </div>

                {saveError ? (
                    <div role="alert" className="mb-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 type-ui text-[var(--color-text-error-primary)]">
                        {saveError}
                    </div>
                ) : null}

                <div className="grid max-h-[52vh] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2" aria-label="Choose your first business goal">
                    {(showAllGoals ? ONBOARDING_GOALS : ONBOARDING_GOALS.slice(0, 3)).map((goal) => {
                        const Icon = goal.icon;
                        const isSelected = selectedId === goal.id;

                        return (
                            <button
                                key={goal.id}
                                type="button"
                                disabled={isSaving}
                                aria-describedby={`${goal.id}-next-step`}
                                onClick={() => handleGoalSelect(goal)}
                                className={`group flex min-h-11 items-start gap-3 rounded-[var(--ws-radius-lg)] border bg-[var(--ws-canvas)]/40 p-4 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue-400,var(--brand-blue-300))] disabled:cursor-wait disabled:opacity-70 ${
                                    isSelected
                                        ? 'border-[var(--brand-blue-500,var(--brand-blue-500))] bg-[var(--brand-blue-500,var(--brand-blue-500))]/10'
                                        : 'border-[var(--ws-border)] hover:border-[var(--brand-blue-500,var(--brand-blue-500))]/60 hover:bg-[var(--ws-surface-secondary)]/70'
                                }`}
                            >
                                <span className="flex-shrink-0 p-2.5 rounded-lg bg-[var(--ws-panel)] border border-[var(--ws-border)] text-[var(--brand-blue-400,var(--brand-blue-300))] group-hover:text-[var(--ws-text-primary)] transition-colors">
                                    <Icon className="w-5 h-5" aria-hidden="true" />
                                </span>
                                <span className="min-w-0 space-y-1">
                                    <span className="block text-base font-semibold text-[var(--ws-text-primary)]">{goal.title}</span>
                                    <span className="block text-[var(--ws-text-muted)] type-ui leading-relaxed">{goal.description}</span>
                                    <span id={`${goal.id}-next-step`} className="block pt-1 type-caption font-medium text-[var(--brand-blue-400,var(--brand-blue-300))]">
                                        Next: {goal.nextStep}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>

                {!showAllGoals && (
                    <button type="button" onClick={() => setShowAllGoals(true)} className="mt-3 min-h-11 rounded-lg px-3 type-ui font-semibold text-[var(--brand-blue-400,var(--brand-blue-300))] hover:bg-[var(--ws-surface-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-blue-400,var(--brand-blue-300))]">
                        See all seven starting points
                    </button>
                )}

                <div className="mt-5 flex flex-col gap-3 border-t border-[var(--ws-border)]/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="type-card-description text-[var(--ws-text-muted)]">You can change direction later. Your existing workspace and permissions stay the same.</p>
                    <button
                        type="button"
                        disabled={isSaving}
                        onClick={handleExploreWorkspace}
                        className="shrink-0 type-ui font-medium text-[var(--ws-text-secondary)] hover:text-[var(--ws-text-primary)] underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue-400,var(--brand-blue-300))] rounded disabled:opacity-50"
                    >
                        Explore the full workspace instead
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default OnboardingFlow;
