'use client';

import React, { useState, useEffect, useRef } from 'react';
import Joyride, { Step, CallBackProps, STATUS, EVENTS, ACTIONS } from 'react-joyride';
import toast from 'react-hot-toast';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { isPlatformAdminRole } from '@/lib/platformAdmin';

interface ProductTourProps {
    isOpen: boolean;
    /** Tour finished, skipped or closed by the user — persist "walkthrough completed". */
    onComplete: () => void;
    /**
     * None of the tour targets are on screen (e.g. opened from a page that has
     * no tour anchors). The parent must flip `isOpen` back to false so the
     * next press of "Platform tour" can start again. Falls back to
     * `onComplete` when omitted so the tour can never get stuck open.
     */
    onUnavailable?: () => void;
    userRole: string; // 'admin' | 'client' | 'tenant_admin' etc.
}

/** Wait this long (10 × 200 ms) for lazily rendered anchors before giving up. */
const TARGET_POLL_INTERVAL_MS = 200;
const TARGET_POLL_MAX_RETRIES = 10;

function isVisibleAnchor(element: HTMLElement): boolean {
    return element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
}

/** True when the anchor is taller/wider than the viewport, so a tooltip can't sit next to it. */
function isOversizedAnchor(element: HTMLElement): boolean {
    if (element.tagName === 'BODY') return true;
    const rect = element.getBoundingClientRect();
    return rect.height > window.innerHeight || rect.width > window.innerWidth;
}

/**
 * The dashboard is a fixed-height app shell that scrolls internally; the
 * window itself must stay at 0. If anything (Joyride, focus) scrolled it, the
 * whole shell disappears above the fold and the page looks blank.
 */
function resetWindowScroll(): void {
    if (typeof window === 'undefined') return;
    if (window.scrollX !== 0 || window.scrollY !== 0) {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
}

const ProductTour: React.FC<ProductTourProps> = ({ isOpen, onComplete, onUnavailable, userRole }) => {
    const { isDark } = useTheme();
    const { t } = useLanguage();
    const completed = useRef(false);
    const [run, setRun] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);
    const [mountedSteps, setMountedSteps] = useState<Step[]>([]);

    useEffect(() => {
        if (typeof document === 'undefined') return;
        if (isOpen && run) {
            document.documentElement.setAttribute('data-product-tour-active', 'true');
            window.addEventListener('scroll', resetWindowScroll, { passive: true });
            return () => {
                document.documentElement.removeAttribute('data-product-tour-active');
                window.removeEventListener('scroll', resetWindowScroll);
                resetWindowScroll();
            };
        }
        document.documentElement.removeAttribute('data-product-tour-active');
    }, [isOpen, run]);

    const adminSteps: Step[] = [
        {
            target: '[data-tour="dashboard-overview"], [data-tour="business-home"], [data-tour="navigation"], body',
            content: t('Welcome to your Command Center! Here you can see real-time stats about your business.'),
            placement: 'center',
            disableBeacon: true,
        },
        {
            target: '[data-tour="navigation"], [data-tour="mobile-nav"]',
            content: t('Use the sidebar to navigate between different sections. All your tools are organized here.'),
            placement: 'right',
        },
        {
            target: '[data-tour="messages"], [data-tour="navigation"]',
            content: t('Communicate with clients instantly. Messages sync in real-time across all devices.'),
            placement: 'bottom',
        },
        {
            target: '[data-tour="projects"], [data-tour="navigation"]',
            content: t('Manage all client projects from here. Track progress, update stages, and collaborate.'),
            placement: 'bottom',
        },
        {
            target: '[data-tour="analytics"], [data-tour="navigation"]',
            content: t('View detailed analytics and insights. Track revenue, project performance, and team productivity.'),
            placement: 'bottom',
        },
        {
            target: '[data-tour="global-search"], [data-tour="navigation"]',
            content: t('Press ⌘K (or Ctrl+K) to quickly search across projects, messages, and clients.'),
            placement: 'bottom',
        },
    ];

    const clientSteps: Step[] = [
        {
            target: '[data-tour="dashboard-overview"], [data-tour="navigation"], body',
            content: t('Welcome to your dashboard! Track your projects and communicate with your team here.'),
            placement: 'center',
            disableBeacon: true,
        },
        {
            target: '[data-tour="my-projects"], [data-tour="navigation"]',
            content: t('View all your active projects. See progress, milestones, and updates in real-time.'),
            placement: 'bottom',
        },
        {
            target: '[data-tour="messages"], [data-tour="navigation"]',
            content: t('Message your project team anytime. Get instant responses and stay in the loop.'),
            placement: 'bottom',
        },
        {
            target: '[data-tour="submit-request"], [data-tour="navigation"]',
            content: t('Submit new project requests here. Describe what you need and we\'ll get started.'),
            placement: 'bottom',
        },
    ];

    const tenantAdminSteps: Step[] = [
        {
            target: '[data-tour="platform-welcome"], [data-tour="business-home"], [data-tour="os-home"], [data-tour="navigation"], body',
            content: t('AlphaClone Systems is your platform for execution — sales, delivery, billing, and ops in one place.'),
            placement: 'center',
            disableBeacon: true,
        },
        {
            target: '[data-tour="os-home"], [data-tour="business-home"], [data-tour="navigation"], body',
            content: t('Your command center surfaces KPIs, attention items, and modules so you know what to execute today.'),
            placement: 'center',
        },
        {
            target: '[data-tour="business-setup-checklist"], [data-tour="business-home"], [data-tour="navigation"], body',
            content: t('New here? Follow these three steps first — add a client, invoice, then connect inbox.'),
            placement: 'center',
        },
        {
            target: '[data-tour="business-home"], [data-tour="os-home"], [data-tour="navigation"], body',
            content: t('This home screen is your daily starting point — stats, blockers, and quick actions for your workspace.'),
            placement: 'center',
        },
        {
            target: '[data-tour="navigation"], [data-tour="mobile-nav"]',
            content: t('Navigation is organized by hub — Sales, Marketing, Money, Insights, and Documents — matching the tabs inside each area.'),
            placement: 'right',
        },
        {
            target: '[data-tour="money-hub-nav"], [data-tour="navigation"]',
            content: t('Money Hub groups billing, invoices, accounting, expenses, and cash flow. Open it to manage revenue end-to-end.'),
            placement: 'right',
        },
        {
            target: '[data-tour="global-search"], [data-tour="navigation"]',
            content: t('Press ⌘K or Ctrl+K to search projects, clients, and messages. Press / to open the command palette.'),
            placement: 'bottom',
        },
        {
            target: '[data-tour="business-notifications"], [data-tour="navigation"]',
            content: t('Notifications appear here for tickets, form submissions, and team alerts.'),
            placement: 'bottom',
        },
        {
            target: '[data-tour="bonnie-widget"], [data-tour="navigation"]',
            content: t('Bonnie is your AI operator — approve actions, run automations, and get a morning brief from this floating assistant.'),
            placement: 'left',
        },
        {
            target: '[data-tour="projects-center"], [data-tour="business-home"], [data-tour="navigation"], body',
            content: t('Projects is where delivery happens — stages, blockers, tasks, and client visibility in one workspace.'),
            placement: 'center',
        },
    ];

    const platformOwnerSteps: Step[] = [
        {
            target: '[data-tour="platform-welcome"], [data-tour="platform-owner-home"], [data-tour="navigation"], body',
            content: t('AlphaClone Systems is the platform for execution — oversee every tenant and service from here.'),
            placement: 'center',
            disableBeacon: true,
        },
        {
            target: '[data-tour="platform-owner-home"], [data-tour="navigation"], body',
            content: t('Your command center shows platform health, tenant activity, missing keys, and ops signals.'),
            placement: 'center',
        },
        {
            target: '[data-tour="navigation"], [data-tour="mobile-nav"]',
            content: t('Use the sidebar to jump between tenants, ops logs, security, subscriptions, and Bonnie AI.'),
            placement: 'right',
        },
        {
            target: '[data-tour="global-search"], [data-tour="navigation"]',
            content: t('Press ⌘K or Ctrl+K to search tenants, users, and records across the platform.'),
            placement: 'bottom',
        },
        {
            target: '[data-tour="business-notifications"], [data-tour="navigation"]',
            content: t('Notifications surface tickets, approvals, and platform alerts here.'),
            placement: 'bottom',
        },
        {
            target: '[data-tour="bonnie-widget"], [data-tour="navigation"]',
            content: t('Bonnie is your AI operator — run platform checks, approvals, and automations from this assistant.'),
            placement: 'left',
        },
        {
            target: '[data-tour="projects-center"], [data-tour="platform-owner-home"], [data-tour="navigation"], body',
            content: t('Projects is where tenant delivery happens — stages, blockers, tasks, and client portals.'),
            placement: 'center',
        },
    ];

    const steps = isPlatformAdminRole(userRole)
        ? platformOwnerSteps
        : userRole === 'tenant_admin' || userRole === 'business_dashboard'
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

        completed.current = false;
        let retries = 0;
        let timerId: ReturnType<typeof setTimeout> | undefined;

        const checkAndStartTour = () => {
            // Only keep steps whose anchor is actually on screen, and show every
            // step's tooltip immediately.
            const available: Step[] = steps.flatMap((step) => {
                if (typeof step.target !== 'string') return [{ ...step, disableBeacon: true }];
                const target = Array.from(document.querySelectorAll<HTMLElement>(step.target)).find(isVisibleAnchor);
                if (!target) return [];
                const placement = isOversizedAnchor(target) ? 'center' : step.placement;
                return [{ ...step, target, placement, disableBeacon: true }];
            });

            if (available.length > 0) {
                setMountedSteps(available);
                setStepIndex(0);
                setRun(true);
                return;
            }

            if (retries < TARGET_POLL_MAX_RETRIES) {
                retries++;
                timerId = setTimeout(checkAndStartTour, TARGET_POLL_INTERVAL_MS);
                return;
            }

            // No step anchor is visible anywhere on this screen. Give control back
            // to the parent instead of leaving run=false and isOpen=true forever.
            setRun(false);
            resetWindowScroll();
            (onUnavailable ?? onComplete)();
            toast(t('The tour is not available on this screen. Try opening it from your dashboard.'));
        };

        checkAndStartTour();

        return () => {
            if (timerId) clearTimeout(timerId);
            resetWindowScroll();
        };
    }, [isOpen, userRole]);

    const completeTour = () => {
        if (completed.current) return;
        completed.current = true;
        setRun(false);
        resetWindowScroll();
        void fetch('/api/account/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walkthrough_completed: true }),
        }).then((response) => {
            if (!response.ok) throw new Error(`Profile update failed (${response.status})`);
        }).catch((err) => console.error('ProductTour: save walkthrough status failed', err));
        onComplete();
    };

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { status, type, action, index } = data;
        if (status === STATUS.FINISHED || status === STATUS.SKIPPED || action === ACTIONS.CLOSE) {
            completeTour();
        } else if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
            const delta = action === ACTIONS.PREV ? -1 : 1;
            const nextIndex = Math.max(0, index + delta);
            if (nextIndex >= mountedSteps.length) completeTour();
            else setStepIndex(nextIndex);
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
            disableOverlay={false}
            disableScrolling
            spotlightClicks
            callback={handleJoyrideCallback}
            styles={{
                options: {
                    primaryColor: '#356AF4',
                    textColor: isDark ? '#F1F5F9' : '#0F172A',
                    backgroundColor: isDark ? '#171A26' : '#FFFFFF',
                    overlayColor: isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(15, 23, 42, 0.55)',
                    arrowColor: isDark ? '#171A26' : '#FFFFFF',
                    zIndex: 10000,
                },
                spotlight: {
                    borderRadius: '12px',
                },
                tooltip: {
                    borderRadius: '14px',
                    padding: '22px 24px',
                    backgroundColor: isDark ? '#171A26' : '#FFFFFF',
                    border: isDark ? '1px solid #282F45' : '1px solid #E2E8F0',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.35), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
                    maxWidth: '420px',
                },
                tooltipContainer: {
                    textAlign: 'left',
                },
                tooltipTitle: {
                    fontSize: '16px',
                    fontWeight: '700',
                    letterSpacing: '-0.01em',
                    color: isDark ? '#FFFFFF' : '#0F172A',
                    marginBottom: '8px',
                },
                tooltipContent: {
                    fontSize: '13.5px',
                    lineHeight: '1.55',
                    color: isDark ? '#94A3B8' : '#475569',
                    padding: '0 0 14px 0',
                },
                buttonNext: {
                    backgroundColor: '#356AF4',
                    color: '#FFFFFF',
                    borderRadius: '8px',
                    padding: '9px 18px',
                    fontSize: '13px',
                    fontWeight: '600',
                    outline: 'none',
                    boxShadow: '0 1px 2px 0 rgba(53, 106, 244, 0.35)',
                },
                buttonBack: {
                    color: isDark ? '#94A3B8' : '#64748B',
                    marginRight: '12px',
                    fontSize: '13px',
                    fontWeight: '500',
                },
                buttonSkip: {
                    color: isDark ? '#64748B' : '#94A3B8',
                    fontSize: '13px',
                },
                buttonClose: {
                    color: isDark ? '#94A3B8' : '#64748B',
                    top: '16px',
                    right: '16px',
                },
            }}
            locale={{
                back: t('Back'),
                close: t('Close'),
                last: t('Get Started'),
                next: t('Next'),
                nextLabelWithProgress: t('Next ({step}/{steps})'),
                skip: t('Skip Tour'),
            }}
        />
    );
};

export default ProductTour;
