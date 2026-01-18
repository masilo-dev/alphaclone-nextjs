import { useEffect, useRef } from 'react';
import { announceToScreenReader } from '../utils/accessibility';

/**
 * Hook for managing focus
 */
export function useFocusManagement() {
    const focusRef = useRef<HTMLElement | null>(null);

    const setFocus = (element: HTMLElement | null) => {
        focusRef.current = element;
        element?.focus();
    };

    const trapFocus = (container: HTMLElement) => {
        const focusableElements = container.querySelectorAll(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        const handleTab = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        };

        container.addEventListener('keydown', handleTab);
        return () => container.removeEventListener('keydown', handleTab);
    };

    return { setFocus, trapFocus, focusRef };
}

/**
 * Hook for screen reader announcements
 */
export function useScreenReaderAnnouncement() {
    const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
        announceToScreenReader(message, priority);
    };

    return { announce };
}

/**
 * Hook for keyboard shortcuts
 */
export function useKeyboardShortcut(
    key: string,
    callback: () => void,
    modifiers?: { ctrl?: boolean; shift?: boolean; alt?: boolean }
) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== key) return;

            if (modifiers) {
                if (modifiers.ctrl && !e.ctrlKey) return;
                if (modifiers.shift && !e.shiftKey) return;
                if (modifiers.alt && !e.altKey) return;
            }

            // Don't trigger if typing in input
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                (e.target as HTMLElement).isContentEditable
            ) {
                return;
            }

            e.preventDefault();
            callback();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [key, callback, modifiers]);
}

/**
 * Hook for ARIA live regions
 */
export function useAriaLiveRegion(priority: 'polite' | 'assertive' = 'polite') {
    const regionRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const region = document.createElement('div');
        region.setAttribute('role', 'status');
        region.setAttribute('aria-live', priority);
        region.setAttribute('aria-atomic', 'true');
        region.className = 'sr-only';
        document.body.appendChild(region);
        regionRef.current = region;

        return () => {
            document.body.removeChild(region);
        };
    }, [priority]);

    const announce = (message: string) => {
        if (regionRef.current) {
            regionRef.current.textContent = message;
        }
    };

    return { announce, regionRef };
}

