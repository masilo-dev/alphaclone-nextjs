import React, { useState } from 'react';
<<<<<<< HEAD
import { Modal } from '../ui/UIComponents';
import { User, Briefcase, Users, Brain, Sparkles, CheckCircle2 } from 'lucide-react';
import { User as UserType } from '../../types';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
=======
import { useRouter } from 'next/navigation';
import { Modal, Button } from '../ui/UIComponents';
import { CheckCircle, ArrowRight, X } from 'lucide-react';
import { User } from '../../types';
import { useOnboardingBranch } from '../../hooks/useOnboardingBranch';
import ProductTour from './ProductTour';
>>>>>>> origin/main

interface OnboardingFlowProps {
    user: UserType;
    onComplete: () => void;
}

interface OnboardingOption {
    id: string;
    title: string;
    description: string;
    icon: React.ComponentType<any>;
    gradient: string;
    borderColor: string;
    textColor: string;
}

const ONBOARDING_OPTIONS: OnboardingOption[] = [
    {
        id: 'Solopreneur',
        title: 'Solopreneur',
        description: 'Build and scale your solo empire with unified systems.',
        icon: User,
        gradient: 'from-pink-500/10 to-rose-500/10 hover:from-pink-500/20 hover:to-rose-500/20',
        borderColor: 'border-pink-500/30 hover:border-pink-500/60',
        textColor: 'text-pink-400',
    },
    {
        id: 'Freelancer',
        title: 'Freelancer',
        description: 'Manage clients, invoices, and execute projects seamlessly.',
        icon: Briefcase,
        gradient: 'from-blue-500/10 to-indigo-500/10 hover:from-blue-500/20 hover:to-indigo-500/20',
        borderColor: 'border-blue-500/30 hover:border-blue-500/60',
        textColor: 'text-blue-400',
    },
    {
        id: 'Agency Founder',
        title: 'Agency Founder',
        description: 'Scale operations, manage contracts, and coordinate teams.',
        icon: Users,
        gradient: 'from-teal-500/10 to-emerald-500/10 hover:from-teal-500/20 hover:to-emerald-500/20',
        borderColor: 'border-teal-500/30 hover:border-teal-500/60',
        textColor: 'text-teal-400',
    },
    {
        id: 'Consultant',
        title: 'Consultant',
        description: 'Provide high-value expertise and drive growth strategies.',
        icon: Brain,
        gradient: 'from-purple-500/10 to-violet-500/10 hover:from-purple-500/20 hover:to-violet-500/20',
        borderColor: 'border-purple-500/30 hover:border-purple-500/60',
        textColor: 'text-purple-400',
    },
    {
        id: 'Coach',
        title: 'Coach',
        description: 'Train, guide, and support your clients on their journeys.',
        icon: Sparkles,
        gradient: 'from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20',
        borderColor: 'border-amber-500/30 hover:border-amber-500/60',
        textColor: 'text-amber-400',
    },
];

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ user, onComplete }) => {
<<<<<<< HEAD
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
=======
    const [currentStep, setCurrentStep] = useState(0);
    const [showTour, setShowTour] = useState(false);
    const router = useRouter();
    const { shouldSkipStep, getPunchyTitle } = useOnboardingBranch(user);
>>>>>>> origin/main

    const handleSelect = async (role: string) => {
        if (isSaving) return;
        setSelectedId(role);
        setIsSaving(true);

<<<<<<< HEAD
        const toastId = toast.loading('Personalizing your command center...');
=======
    const steps: OnboardingStep[] = [
        {
            id: 'welcome',
            title: 'Mission Control Initialized.',
            description: 'Your unfair advantage is ready to deploy. Takes 60 seconds.',
            icon: <CheckCircle className="w-16 h-16 text-teal-400" />,
        },
        {
            id: 'profile',
            title: 'Identity Secure.',
            description: 'Upload your photo so we know who is in charge here.',
            icon: <CheckCircle className="w-16 h-16 text-blue-400" />,
            action: {
                label: 'Polish Profile',
                onClick: () => {
                    router.push('/dashboard/settings?tab=profile');
                },
            },
        },
        {
            id: 'integrations',
            title: 'Connect Your Stack.',
            description: 'Hook up Gmail and Stripe to automate the daily grind.',
            icon: <CheckCircle className="w-16 h-16 text-orange-400" />,
            action: {
                label: 'Link Accounts',
                onClick: () => {
                    router.push('/dashboard/settings?tab=integrations');
                },
            },
        },
        {
            id: 'tour',
            title: 'The Grand Tour.',
            description: '60 seconds to master your new Business OS.',
            icon: <CheckCircle className="w-16 h-16 text-purple-400" />,
            action: {
                label: 'Show Me',
                onClick: () => {
                    setShowTour(true);
                },
            },
        },
        {
            id: 'finish',
            title: 'Let\'s Get Dangerous.',
            description: 'Execution starts now. Go get them.',
            icon: <CheckCircle className="w-16 h-16 text-green-400" />,
            action: {
                label: 'Ignite Dashboard',
                onClick: () => {
                    handleComplete();
                },
            },
        },
    ];
>>>>>>> origin/main

        try {
            const profileResponse = await fetch('/api/account/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ onboardingRole: role, onboardingCompleted: true }) });
            if (!profileResponse.ok) throw new Error('Onboarding profile could not be saved');

            // 4. Update auth user metadata for current session availability
            await supabase.auth.updateUser({
                data: {
                    onboarding_role: role,
                    onboarding_completed: true,
                },
            });

            // 5. Save to localStorage for instant UI resolution
            localStorage.setItem(`onboarding_completed_${user.id}`, 'true');

            toast.success('Your workspace is ready!', { id: toastId });

            // Small delay for animations
            setTimeout(() => {
                onComplete();
            }, 800);

        } catch (err: any) {
            console.error('OnboardingFlow: Update failed:', err);
            toast.error(`Setup could not be saved: ${err.message || err}. Moving to dashboard...`, { id: toastId });
            
            // Allow them to access dashboard regardless to prevent drop-off blockages
            localStorage.setItem(`onboarding_completed_${user.id}`, 'true');
            setTimeout(() => {
                onComplete();
            }, 1000);
        } finally {
            setIsSaving(false);
        }
    };

    return (
<<<<<<< HEAD
        <Modal
            isOpen={true}
            onClose={() => {
                // If they close, complete the flow using a default option to avoid gating issues
                handleSelect('Solopreneur');
            }}
            title=""
            className="max-w-3xl overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl"
        >
            <div className="relative p-6 sm:p-8">
                {/* Header */}
                <div className="text-center space-y-3 mb-10">
                    <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-teal-500/10 text-teal-400 mb-2">
                        <Sparkles className="w-6 h-6 animate-pulse" />
=======
        <>
            <Modal
                isOpen={true}
                onClose={handleSkip}
                title=""
            >
                <div className="relative">
                    {/* Progress Bar */}
                    <div className="mb-8">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-black uppercase tracking-widest text-teal-400">Mission Progress: Step {currentStep + 1} of {steps.length}</span>
                            <button
                                onClick={handleSkip}
                                className="text-slate-400 hover:text-white transition-colors"
                                aria-label="Skip onboarding"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-teal-500 to-blue-500 h-full transition-all duration-500 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    {/* Step Content */}
                    <div className="text-center space-y-6 py-8">
                        <div className="flex justify-center">
                            {currentStepData?.icon}
                        </div>

                        <div>
                            <h3 className="text-3xl font-black text-white mb-4 tracking-tight">
                                {currentStepData?.title}
                            </h3>
                            <p className="text-slate-400 text-xl max-w-md mx-auto leading-relaxed">
                                {currentStepData?.description}
                            </p>
                        </div>

                        {/* Step Indicators */}
                        <div className="flex justify-center gap-2 pt-4">
                            {steps.map((step, index) => (
                                <div
                                    key={step.id}
                                    className={`h-2 rounded-full transition-all ${index <= currentStep
                                        ? 'bg-teal-500 w-8'
                                        : 'bg-slate-700 w-2'
                                        }`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-between items-center pt-6 border-t border-slate-800">
                        <button
                            onClick={handleSkip}
                            className="text-slate-400 hover:text-white transition-colors text-sm"
                        >
                            I\'ll finish this later
                        </button>

                        <div className="flex gap-3">
                            {currentStep > 0 && (
                                <Button
                                    variant="outline"
                                    onClick={() => setCurrentStep(currentStep - 1)}
                                >
                                    Back
                                </Button>
                            )}
                            {currentStepData?.action ? (
                                <Button
                                    onClick={() => {
                                        currentStepData.action?.onClick();
                                        if (currentStepData.id !== 'finish') {
                                            handleNext();
                                        }
                                    }}
                                    className="bg-white text-black hover:bg-slate-200 px-8 py-6 text-lg font-black rounded-full"
                                >
                                    {currentStepData.action?.label}
                                    <ArrowRight className="w-5 h-5 ml-2" />
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleNext}
                                    className="bg-white text-black hover:bg-slate-200 px-8 py-6 text-lg font-black rounded-full"
                                >
                                    {currentStep === steps.length - 1 ? 'Get Started' : 'Next →'}
                                </Button>
                            )}
                        </div>
>>>>>>> origin/main
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                        Customize Your Command Center
                    </h2>
                    <p className="text-slate-400 text-lg max-w-lg mx-auto">
                        What best describes your current business configuration?
                    </p>
                </div>

                {/* Option Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto pr-1">
                    {ONBOARDING_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const isSelected = selectedId === option.id;

                        return (
                            <button
                                key={option.id}
                                disabled={isSaving}
                                onClick={() => handleSelect(option.id)}
                                className={`group flex items-start gap-4 p-5 rounded-2xl text-left border bg-slate-950/40 backdrop-blur-md transition-all duration-300 transform select-none ${
                                    isSelected
                                        ? 'border-teal-500 bg-teal-500/5 scale-[0.98]'
                                        : `${option.borderColor} ${option.gradient} hover:scale-[1.02]`
                                }`}
                            >
                                <div className={`flex-shrink-0 p-3 rounded-xl bg-slate-900 border transition-all duration-300 ${
                                    isSelected 
                                        ? 'border-teal-500/50 text-teal-400' 
                                        : 'border-slate-800 text-slate-400 group-hover:text-white'
                                }`}>
                                    {isSelected ? (
                                        <CheckCircle2 className="w-6 h-6 text-teal-400 animate-scale-up" />
                                    ) : (
                                        <Icon className="w-6 h-6" />
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <h3 className={`font-bold text-lg transition-colors ${
                                        isSelected ? 'text-teal-400' : 'text-white group-hover:text-white'
                                    }`}>
                                        {option.title}
                                    </h3>
                                    <p className="text-slate-400 text-sm leading-relaxed">
                                        {option.description}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Bottom branding footer */}
                <div className="text-center mt-10 pt-6 border-t border-slate-800/60">
                    <span className="text-xs text-slate-500 tracking-wider uppercase font-medium">
                        AlphaClone Operating OS • High Isolation Workspace Setup
                    </span>
                </div>
            </div>
        </Modal>
    );
};

export default OnboardingFlow;
