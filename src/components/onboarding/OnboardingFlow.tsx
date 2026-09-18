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
        description: 'Plan client work, assign tasks, and see what needs attention.',
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
            window.dispatchEvent(new CustomEvent('alphaclone:onboarding-updated'));
            toast.success(nextPath ? 'Your first path is ready.' : 'Your full workspace is ready.', { id: toastId });
            onComplete(nextPath);
        } catch (err) {
            console.error('OnboardingFlow: Update failed:', err);
            const message = err instanceof Error ? err.message : 'Your choice could not be saved.';
            setSaveError(`${message} Please try again. Nothing has been changed.`);
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
            title=""
            className="max-w-4xl overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl"
        >
            <div className="relative p-5 sm:p-8">
                <div className="text-center space-y-3 mb-7">
                    <div className="inline-flex items-center justify-center p-2 rounded-xl bg-[var(--brand-blue-500,#356AF4)]/15 text-[var(--brand-blue-400,#91B5FF)]">
                        <Sparkles className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand-blue-400,#91B5FF)]">Welcome to AlphaClone</p>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                        What do you want AlphaClone to do for your business?
                    </h2>
                    <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto">
                        Start with one useful outcome. You can use every tool in your workspace whenever you need it.
                    </p>
                </div>

                {saveError ? (
                    <div role="alert" className="mb-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                        {saveError}
                    </div>
                ) : null}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[52vh] overflow-y-auto pr-1" aria-label="Choose your first business goal">
                    {ONBOARDING_GOALS.map((goal) => {
                        const Icon = goal.icon;
                        const isSelected = selectedId === goal.id;

                        return (
                            <button
                                key={goal.id}
                                type="button"
                                disabled={isSaving}
                                aria-describedby={`${goal.id}-next-step`}
                                onClick={() => handleGoalSelect(goal)}
                                className={`group flex items-start gap-3 p-4 rounded-xl text-left border bg-slate-950/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue-400,#91B5FF)] disabled:cursor-wait disabled:opacity-70 ${
                                    isSelected
                                        ? 'border-[var(--brand-blue-500,#356AF4)] bg-[var(--brand-blue-500,#356AF4)]/10'
                                        : 'border-slate-800 hover:border-[var(--brand-blue-500,#356AF4)]/60 hover:bg-slate-800/70'
                                }`}
                            >
                                <span className="flex-shrink-0 p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[var(--brand-blue-400,#91B5FF)] group-hover:text-white transition-colors">
                                    <Icon className="w-5 h-5" aria-hidden="true" />
                                </span>
                                <span className="min-w-0 space-y-1">
                                    <span className="block font-semibold text-base text-white">{goal.title}</span>
                                    <span className="block text-slate-400 text-sm leading-relaxed">{goal.description}</span>
                                    <span id={`${goal.id}-next-step`} className="block pt-1 text-xs font-medium text-[var(--brand-blue-400,#91B5FF)]">
                                        Next: {goal.nextStep}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-6 pt-5 border-t border-slate-800/60">
                    <p className="text-xs text-slate-500">You can change direction later. Your existing workspace and permissions stay the same.</p>
                    <button
                        type="button"
                        disabled={isSaving}
                        onClick={handleExploreWorkspace}
                        className="shrink-0 text-sm font-medium text-slate-300 hover:text-white underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue-400,#91B5FF)] rounded disabled:opacity-50"
                    >
                        Explore the full workspace instead
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default OnboardingFlow;
