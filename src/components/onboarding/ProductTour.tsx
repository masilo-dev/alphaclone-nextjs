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
    const [mountedSteps, setMountedSteps] = useState<Step[]>([]);

    useEffect(() => {
        if (typeof document === 'undefined') return;
        if (isOpen && run) {
            document.documentElement.setAttribute('data-product-tour-active', 'true');
            return () => document.documentElement.removeAttribute('data-product-tour-active');
        }
        document.documentElement.removeAttribute('data-product-tour-active');
    }, [isOpen, run]);

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

    const tenantAdminSteps: Step[] = [
        {
            target: '[data-tour="business-setup-checklist"]',
            content: 'New here? Follow these three steps first — add a client, invoice, then connect inbox.',
            placement: 'bottom',
        },
        {
            target: '[data-tour="business-home"]',
            content: 'Welcome to your Business OS. This home screen shows setup steps and quick actions for your workspace.',
            placement: 'bottom',
            disableBeacon: true,
        },
        {
            target: '[data-tour="navigation"]',
            content: 'Navigation is organized by hub — Sales, Marketing, Money, Insights, and Documents — matching the tabs inside each area.',
            placement: 'right',
        },
        {
            target: '[data-tour="money-hub-nav"]',
            content: 'Money Hub groups billing, invoices, accounting, expenses, and cash flow. Open it to manage revenue end-to-end.',
            placement: 'right',
        },
        {
            target: '[data-tour="global-search"]',
            content: 'Press ⌘K or Ctrl+K to search projects, clients, and messages. Press / to open the command palette.',
            placement: 'bottom',
        },
        {
            target: '[data-tour="business-notifications"]',
            content: 'Notifications appear here for tickets, form submissions, and team alerts.',
            placement: 'bottom',
        },
        {
            target: '[data-tour="bonnie-widget"]',
            content: 'Bonnie is your AI operator — approve actions, run automations, and get a morning brief from this floating assistant.',
            placement: 'left',
        },
    ];

    const steps =
        userRole === 'tenant_admin'
            ? tenantAdminSteps
            : userRole === 'admin'
              ? adminSteps
              : clientSteps;

    useEffect(() => {
        if (!isOpen || typeof document === 'undefined') {
            setRun(false);
            setMountedSteps([]);
            return;
        }

        let retries = 0;
        const maxRetries = 10;
        let timerId: NodeJS.Timeout;

        const checkAndStartTour = () => {
            const available = steps.filter((step) =>
                typeof step.target === 'string' ? Boolean(document.querySelector(step.target)) : true
            );

            if (available.length > 0 || retries >= maxRetries) {
                setMountedSteps(available.length > 0 ? available : steps);
                setStepIndex(0);
                setRun(true);
            } else {
                retries++;
                timerId = setTimeout(checkAndStartTour, 200);
            }
        };

        checkAndStartTour();

        return () => {
            if (timerId) clearTimeout(timerId);
        };
    }, [isOpen, userRole]);

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { status, index } = data;

        if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
            setRun(false);
            fetch('/api/account/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walkthrough_completed: true }),
            }).catch((err) => console.error('ProductTour: save walkthrough status failed', err));
            onComplete();
        } else if (status === STATUS.RUNNING) {
            setStepIndex(index);
        }
    };

    if (!isOpen) return null;

    return (
        <Joyride
            steps={mountedSteps}
            run={run}
            stepIndex={stepIndex}
            continuous
            showProgress
            showSkipButton
            disableOverlay
            disableScrolling
            spotlightClicks
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
