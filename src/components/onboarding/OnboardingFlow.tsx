import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, Button } from '../ui/UIComponents';
import { CheckCircle, ArrowRight, X } from 'lucide-react';
import ProductTour from './ProductTour';
import { User } from '../../types';

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

    const markStepComplete = () => {
        // Mark step complete (could be used for tracking)
    };

    const steps: OnboardingStep[] = [
        {
            id: 'welcome',
            title: `Welcome, ${user.name}!`,
            description: 'Let\'s get you set up in just a few steps. This will only take 2 minutes.',
            icon: <CheckCircle className="w-12 h-12 text-teal-400" />,
        },
        {
            id: 'profile',
            title: 'Complete Your Profile',
            description: 'Add your photo and contact information so your team can reach you easily.',
            icon: <CheckCircle className="w-12 h-12 text-blue-400" />,
            action: {
                label: 'Go to Settings',
                onClick: () => {
                    handleComplete();
                    router.push('/dashboard/settings');
                    markStepComplete();
                },
            },
        },
        {
            id: 'tour',
            title: 'Take a Product Tour',
            description: 'Let us show you around. You can skip this and explore on your own if you prefer.',
            icon: <CheckCircle className="w-12 h-12 text-purple-400" />,
            action: {
                label: 'Start Tour',
                onClick: () => {
                    setShowTour(true);
                    markStepComplete();
                },
            },
        },
        {
            id: 'first-project',
            title: user.role === 'client' ? 'Your Dashboard Awaits' : 'Ready to Get Started',
            description: user.role === 'client'
                ? 'Your dashboard is ready. You can explore projects, messages, and more.'
                : 'Everything is set up. Start managing projects and clients from your dashboard.',
            icon: <CheckCircle className="w-12 h-12 text-green-400" />,
            action: {
                label: 'Go to Dashboard',
                onClick: () => {
                    handleComplete();
                    router.push('/dashboard');
                    markStepComplete();
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
                            <span className="text-sm text-slate-400">Step {currentStep + 1} of {steps.length}</span>
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
                            <h3 className="text-2xl font-bold text-white mb-3">{currentStepData?.title}</h3>
                            <p className="text-slate-400 text-lg max-w-md mx-auto">
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
                            Skip Onboarding
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
                                        handleNext();
                                    }}
                                    className="bg-teal-600 hover:bg-teal-500"
                                >
                                    {currentStepData.action?.label}
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleNext}
                                    className="bg-teal-600 hover:bg-teal-500"
                                >
                                    {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
                                    <ArrowRight className="w-4 h-4 ml-2" />
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

