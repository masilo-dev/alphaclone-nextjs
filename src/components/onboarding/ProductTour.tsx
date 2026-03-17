import React, { useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';

interface ProductTourProps {
    isOpen: boolean;
    onComplete: () => void;
    userRole: string; // 'admin' | 'client' | 'tenant_admin' etc.
}

const ProductTour: React.FC<ProductTourProps> = ({ isOpen, onComplete, userRole }) => {
    const [run, setRun] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);

    useEffect(() => {
        if (isOpen) {
            setRun(true);
            setStepIndex(0);
        }
    }, [isOpen]);

    const adminSteps: Step[] = [
        {
            target: '[data-tour="dashboard-overview"]',
            content: 'Welcome to your Command Center! Here you can see real-time stats about your business.',
            placement: 'bottom',
            disableBeacon: true,
        },
        {
            target: '[data-tour="navigation"]',
            content: 'Use the sidebar to navigate between different sections. All your tools are organized here.',
            placement: 'right',
        },
        {
            target: '[data-tour="messages"]',
            content: 'Communicate with clients instantly. Messages sync in real-time across all devices.',
            placement: 'bottom',
        },
        {
            target: '[data-tour="projects"]',
            content: 'Manage all client projects from here. Track progress, update stages, and collaborate.',
            placement: 'bottom',
        },
        {
            target: '[data-tour="analytics"]',
            content: 'View detailed analytics and insights. Track revenue, project performance, and team productivity.',
            placement: 'bottom',
        },
        {
            target: '[data-tour="global-search"]',
            content: 'Press ⌘K (or Ctrl+K) to quickly search across projects, messages, and clients.',
            placement: 'bottom',
        },
    ];

    const clientSteps: Step[] = [
        {
            target: '[data-tour="dashboard-overview"]',
            content: 'Welcome to your dashboard! Track your projects and communicate with your team here.',
            placement: 'bottom',
            disableBeacon: true,
        },
        {
            target: '[data-tour="my-projects"]',
            content: 'View all your active projects. See progress, milestones, and updates in real-time.',
            placement: 'bottom',
        },
        {
            target: '[data-tour="messages"]',
            content: 'Message your project team anytime. Get instant responses and stay in the loop.',
            placement: 'bottom',
        },
        {
            target: '[data-tour="submit-request"]',
            content: 'Submit new project requests here. Describe what you need and we\'ll get started.',
            placement: 'bottom',
        },
    ];

    const steps = userRole === 'admin' ? adminSteps : clientSteps;

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { status, index } = data;

        if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
            setRun(false);
            onComplete();
        } else if (status === STATUS.RUNNING) {
            setStepIndex(index);
        }
    };

    if (!isOpen) return null;

    return (
        <Joyride
            steps={steps}
            run={run}
            stepIndex={stepIndex}
            continuous
            showProgress
            showSkipButton
            callback={handleJoyrideCallback}
            styles={{
                options: {
                    primaryColor: '#2dd4bf',
                    textColor: '#ffffff',
                    backgroundColor: '#0f172a',
                    overlayColor: 'rgba(0, 0, 0, 0.8)',
                    arrowColor: '#1e293b',
                    zIndex: 10000,
                },
                tooltip: {
                    borderRadius: '12px',
                    padding: '20px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                },
                tooltipContainer: {
                    textAlign: 'left',
                },
                buttonNext: {
                    backgroundColor: '#2dd4bf',
                    color: '#020617',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: '600',
                },
                buttonBack: {
                    color: '#94a3b8',
                    marginRight: '10px',
                },
                buttonSkip: {
                    color: '#64748b',
                },
            }}
            locale={{
                back: 'Back',
                close: 'Close',
                last: 'Finish',
                next: 'Next',
                skip: 'Skip Tour',
            }}
        />
    );
};

export default ProductTour;

