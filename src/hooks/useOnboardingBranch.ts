import { useMemo } from 'react';
import { User } from '../types';

export type OnboardingBranch = 'founder' | 'consultant' | 'agency' | 'default';

export const useOnboardingBranch = (user: User | null) => {
    const branch = useMemo((): OnboardingBranch => {
        if (!user) return 'default';
        
        const role = user.role?.toLowerCase();
        const metadata = user.user_metadata as any;
        const businessType = metadata?.business_type?.toLowerCase() || '';
        
        if (role === 'founder' || businessType === 'founder') return 'founder';
        if (role === 'consultant' || businessType === 'consulting') return 'consultant';
        if (role === 'agency' || businessType === 'agency') return 'agency';
        
        return 'default';
    }, [user]);

    const shouldSkipStep = (stepId: string): boolean => {
        if (branch === 'consultant') {
            // Consultants usually work solo, skip team setup
            if (stepId === 'team' || stepId === 'invite-team') return true;
        }
        return false;
    };

    const getPunchyTitle = (stepId: string): string | null => {
        if (branch === 'founder') {
            if (stepId === 'welcome') return 'Your unfair advantage just loaded.';
            if (stepId === 'profile') return 'Let\'s get you dangerous. Takes 60 seconds.';
        }
        if (branch === 'consultant') {
            if (stepId === 'welcome') return 'Ready to scale your expertise?';
            if (stepId === 'profile') return 'Let\'s polish your expert profile.';
        }
        return null;
    };

    return {
        branch,
        shouldSkipStep,
        getPunchyTitle
    };
};
