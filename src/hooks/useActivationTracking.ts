import { useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';

export type ActivationEvent = 
    | 'first_lead_discovery' 
    | 'first_invoice_sent' 
    | 'first_deal_closed' 
    | 'onboarding_complete';

export const useActivationTracking = () => {
    const [achievements, setAchievements] = useState<Set<string>>(new Set());

    const triggerCelebration = useCallback((title: string, message: string) => {
        // Confetti burst
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval: any = setInterval(function() {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);

        // Success message
        toast.success(`${title}: ${message}`, {
            duration: 5000,
            icon: '🚀',
            style: {
                background: '#0f172a',
                color: '#fff',
                border: '1px solid #14b8a6',
                padding: '16px',
                fontSize: '16px',
                fontWeight: 'bold'
            }
        });
    }, []);

    const trackEvent = useCallback((event: ActivationEvent) => {
        if (achievements.has(event)) return;

        setAchievements(prev => new Set([...prev, event]));

        switch (event) {
            case 'first_lead_discovery':
                triggerCelebration('MISSION CRITICAL', 'First lead captured. You\'re officially dangerous.');
                break;
            case 'first_invoice_sent':
                triggerCelebration('REVENUE UNLOCKED', 'Invoice dispatched. Go get that paper.');
                break;
            case 'first_deal_closed':
                triggerCelebration('BOOM', 'Deal closed. The hustle is paying off.');
                break;
            case 'onboarding_complete':
                triggerCelebration('SYSTEMS ONLINE', 'You\'re set up and ready to dominate.');
                break;
        }
    }, [achievements, triggerCelebration]);

    return {
        trackEvent,
        achievements
    };
};
