import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, Button } from '../ui/UIComponents';
import { CheckCircle, ArrowRight, X } from 'lucide-react';
import { User } from '../../types';
import { useOnboardingBranch } from '../../hooks/useOnboardingBranch';
import ProductTour from './ProductTour';

interface OnboardingFlowProps {
    user: User;
    onComplete: () => void;
}

interface OnboardingStep {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    action?: {
        label: string;
        onClick: () => void;
    };
}

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ user, onComplete }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [showTour, setShowTour] = useState(false);
    const router = useRouter();
    const { shouldSkipStep, getPunchyTitle } = useOnboardingBranch(user);

    const markStepComplete = () => {
        // Mark step complete (could be used for tracking)
    };

    const steps: OnboardingStep[] = [
        {
            id: 'welcome',
            title: 'Command Center Ready.',
            description: 'Your workspace is ready. Connect the basics or go straight to the dashboard.',
            icon: <CheckCircle className="w-16 h-16 text-teal-400" />,
        },
        {
            id: 'profile',
            title: 'Profile Setup.',
            description: 'Add a profile photo so teammates know who owns the work.',
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
            title: 'Connect Your Operating Stack.',
            description: 'Connect Gmail and Stripe when you are ready to route email and payments through AlphaClone.',
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
            title: 'Workspace Tour.',
            description: 'See where CRM, projects, finance, and contracts live in your Business OS.',
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
            title: 'Your command center is ready.',
            description: 'Open the dashboard and start with the next real workflow.',
            icon: <CheckCircle className="w-16 h-16 text-green-400" />,
            action: {
                label: 'Open Dashboard',
                onClick: () => {
                    handleComplete();
                },
            },
        },
    ];

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleComplete();
        }
    };

    const handleSkip = () => {
        handleComplete();
    };

    const handleComplete = () => {
        localStorage.setItem(`onboarding_completed_${user.id}`, 'true');
        onComplete();
    };

    const currentStepData = steps[currentStep];
    const progress = ((currentStep + 1) / steps.length) * 100;

    return (
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
                    </div>
                </div>
            </Modal>

            <ProductTour
                isOpen={showTour}
                onComplete={() => {
                    setShowTour(false);
                    handleNext();
                }}
                userRole={user.role === 'visitor' ? 'client' : user.role}
            />
        </>
    );
};

export default OnboardingFlow;
